import { and, eq, inArray } from "drizzle-orm";
import { getArtist } from "../cache/lastfm";
import { getCachedArtistTrack } from "../cache/tracks";
import { reasonCache } from "../db/schema";
import { REASONS_PROMPT_VERSION, pickReasons, seedKey, type ReasonsInput, type ReasonsOutput } from "../utils/reasons-prompt";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { hitRateLimit } from "./rate-limit";
import { getRecommendations } from "./recommendations";

// LLM-written reasons for a recommendations list. The list is rebuilt here from the same seeds the
// page sent, never taken from the client, so nobody can make the model write about arbitrary text.
// Cached per seed set + artist; without a writer (no API key), over the daily cap, or when the model
// fails, records get null and the page keeps "Similar to …"

export type ReasonsWriter = { write(input: ReasonsInput): Promise<ReasonsOutput> };

type Deps = Parameters<typeof getRecommendations>[0] & { writer: ReasonsWriter | null; dailyLimit?: number };

// Site-wide; about $0.0003 a call with Claude Haiku 5.5, so at most about $0.10 a day
const DAILY_CALLS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
// Enough to describe a seed's sound without crowding the prompt
const TAGS_PER_SEED = 5;

export async function getReasons(
  deps: Deps,
  { seeds, exclude = [] }: { seeds: string[]; exclude?: string[] },
): Promise<Record<string, string | null>> {
  const { db } = deps;
  const list = await getRecommendations(deps, { seeds, exclude, previews: "cached" });
  const records = list.recommendations;
  if (records.length === 0) return {};

  const key = seedKey(list.seeds);
  const cachedRows = await db
    .select({ artistNorm: reasonCache.artistNorm, reason: reasonCache.reason })
    .from(reasonCache)
    .where(
      and(
        eq(reasonCache.seedKey, key),
        eq(reasonCache.promptVersion, REASONS_PROMPT_VERSION),
        inArray(reasonCache.artistNorm, records.map((r) => normalizeArtistName(r.artist))),
      ),
    );
  const known = new Map(cachedRows.map((row) => [row.artistNorm, row.reason]));
  const missing = records.filter((r) => !known.has(normalizeArtistName(r.artist)));

  if (missing.length > 0 && deps.writer && (await takeDailyCall(deps))) {
    const written = await writeReasons(deps, deps.writer, list.seeds, missing);
    if (written) {
      await db
        .insert(reasonCache)
        .values([...written].map(([artistNorm, reason]) => ({ seedKey: key, artistNorm, promptVersion: REASONS_PROMPT_VERSION, reason })))
        .onConflictDoNothing();
      for (const [artistNorm, reason] of written) known.set(artistNorm, reason);
    }
  }

  return Object.fromEntries(records.map((r) => [r.artist, known.get(normalizeArtistName(r.artist)) ?? null]));
}

async function takeDailyCall({ db, now, dailyLimit = DAILY_CALLS }: Deps) {
  const result = await hitRateLimit({ db, now }, "daily:llm-reasons", { limit: dailyLimit, windowMs: DAY_MS });
  return result.allowed;
}

// null when the model fails: nothing is cached, so the next visit tries again
async function writeReasons(
  deps: Deps,
  writer: ReasonsWriter,
  seeds: string[],
  records: { artist: string; sources: string[] }[],
): Promise<Map<string, string | null> | null> {
  // Both are cached by getRecommendations and the preview lookups, so no API calls here
  const seedInfo = await Promise.all(
    seeds.map(async (name) => ({ name, tags: (await getArtist(deps, name)).tags.slice(0, TAGS_PER_SEED) })),
  );
  const withTracks = await Promise.all(
    records.map(async (r) => ({
      artist: r.artist,
      sources: r.sources,
      track: (await getCachedArtistTrack(deps, r.artist))?.title ?? null,
    })),
  );
  try {
    const output = await writer.write({ seeds: seedInfo, records: withTracks });
    return pickReasons(output, records.map((r) => r.artist));
  } catch (err) {
    console.error("Writing recommendation reasons failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
