import { and, eq, inArray } from "drizzle-orm";
import { getArtist } from "../cache/lastfm";
import { getCachedArtistTrack } from "../cache/tracks";
import { reasonCache } from "../db/schema";
import { REASONS_PROMPT_VERSION, seedKey, usableReason, type ReasonEntry, type ReasonsInput } from "../utils/reasons-prompt";
import type { Popularity } from "../../shared/types/popularity";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { hitRateLimit } from "./rate-limit";
import { getRecommendations } from "./recommendations";

// LLM-written reasons for a recommendations list, streamed: cached reasons go out at once, then
// each new one as the model finishes it. The list is rebuilt here from the same seeds the page
// sent, never taken from the client, so nobody can make the model write about arbitrary text.
// Each reason is saved as it arrives (per seed set + artist), so a retry after a failure asks
// only about the records still missing. Without a writer (no API key), over the daily cap, or when
// the model fails or is too slow, the stream ends with "stopped" and why

export type ReasonsWriter = {
  stream(input: ReasonsInput, options?: { signal?: AbortSignal }): AsyncIterable<ReasonEntry>;
};

export type ReasonsEvent =
  | { type: "reason"; artist: string; reason: string | null }
  | { type: "done" }
  | { type: "stopped"; why: "off" | "limit" | "failed" | "timeout" };

type Deps = Parameters<typeof getRecommendations>[0] & {
  writer: ReasonsWriter | null;
  dailyLimit?: number;
  timeoutMs?: number;
};

// Site-wide; about $0.0003 a call with Claude Haiku 5.5, so at most about $0.10 a day
const DAILY_CALLS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
// Enough to describe a seed's sound without crowding the prompt
const TAGS_PER_SEED = 5;
// A list's reasons take a few seconds; past this the page shows "Taking too long" with a retry
const TIMEOUT_MS = 20_000;

// signal: the visitor went away. Nothing more is sent then, and the model call is cancelled
export async function streamReasons(
  deps: Deps,
  {
    seeds,
    exclude = [],
    popularity,
    first,
  }: { seeds: string[]; exclude?: string[]; popularity?: Popularity; first?: string },
  emit: (event: ReasonsEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { db } = deps;
  const list = await getRecommendations(deps, { seeds, exclude, popularity, previews: "cached" });
  const records = list.recommendations;
  if (records.length === 0) return emit({ type: "done" });

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
  const cached = new Map(cachedRows.map((row) => [row.artistNorm, row.reason]));
  for (const r of records) {
    const norm = normalizeArtistName(r.artist);
    if (cached.has(norm)) emit({ type: "reason", artist: r.artist, reason: cached.get(norm)! });
  }

  // The record on screen first, so its reason arrives first
  const firstNorm = first ? normalizeArtistName(first) : null;
  const missing = records
    .filter((r) => !cached.has(normalizeArtistName(r.artist)))
    .sort((a, b) => Number(normalizeArtistName(b.artist) === firstNorm) - Number(normalizeArtistName(a.artist) === firstNorm));
  if (missing.length === 0) return emit({ type: "done" });
  if (!deps.writer) return emit({ type: "stopped", why: "off" });
  if (!(await takeDailyCall(deps))) return emit({ type: "stopped", why: "limit" });

  const pending = new Map(missing.map((r) => [normalizeArtistName(r.artist), r.artist]));
  const send = async (norm: string, reason: string | null) => {
    const artist = pending.get(norm)!;
    pending.delete(norm);
    await db.insert(reasonCache).values({ seedKey: key, artistNorm: norm, promptVersion: REASONS_PROMPT_VERSION, reason }).onConflictDoNothing();
    if (!signal?.aborted) emit({ type: "reason", artist, reason });
  };

  const call = new AbortController();
  const onLeave = () => call.abort("left");
  // The visitor may have left while the list was being rebuilt, before anyone was listening
  if (signal?.aborted) onLeave();
  signal?.addEventListener("abort", onLeave);
  const timer = setTimeout(() => call.abort("timeout"), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    const input = await promptInput(deps, list.seeds, missing);
    // Aborting stops the SDK's reads; racing against the abort also covers a writer that waits
    // without reading (and the tests' fakes)
    const aborted = new Promise<never>((_, reject) => {
      const fail = () => reject(new Error(`aborted: ${call.signal.reason}`));
      if (call.signal.aborted) fail();
      else call.signal.addEventListener("abort", fail);
    });
    // Only awaited through the race below; without this an abort between reads is "unhandled"
    aborted.catch(() => {});
    const iterator = deps.writer.stream(input, { signal: call.signal })[Symbol.asyncIterator]();
    for (;;) {
      const next = await Promise.race([iterator.next(), aborted]);
      if (next.done) break;
      const norm = normalizeArtistName(next.value.artist);
      // Artists nobody asked about, and repeats, are ignored
      if (pending.has(norm)) await send(norm, usableReason(next.value.reason));
    }
    // Finished normally: records the model left out get null, saved so we don't ask again
    for (const norm of [...pending.keys()]) await send(norm, null);
    if (!signal?.aborted) emit({ type: "done" });
  } catch (err) {
    if (call.signal.reason === "left") return;
    if (call.signal.reason === "timeout") return emit({ type: "stopped", why: "timeout" });
    console.error("Writing recommendation reasons failed:", err instanceof Error ? err.message : err);
    emit({ type: "stopped", why: "failed" });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onLeave);
  }
}

async function takeDailyCall({ db, now, dailyLimit = DAILY_CALLS }: Deps) {
  const result = await hitRateLimit({ db, now }, "daily:llm-reasons", { limit: dailyLimit, windowMs: DAY_MS });
  return result.allowed;
}

// Both are cached by getRecommendations and the preview lookups, so no API calls here
async function promptInput(deps: Deps, seeds: string[], records: { artist: string; sources: string[] }[]): Promise<ReasonsInput> {
  return {
    seeds: await Promise.all(
      seeds.map(async (name) => ({ name, tags: (await getArtist(deps, name)).tags.slice(0, TAGS_PER_SEED) })),
    ),
    records: await Promise.all(
      records.map(async (r) => ({
        artist: r.artist,
        sources: r.sources,
        track: (await getCachedArtistTrack(deps, r.artist))?.title ?? null,
      })),
    ),
  };
}
