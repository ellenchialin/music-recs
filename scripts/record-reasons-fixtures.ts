// Asks Claude for real recommendation reasons, prints them for a quality check, and records the
// first raw response as a test fixture. Costs a fraction of a cent per list. Run by hand when the
// prompt changes: pnpm record:reasons (needs ANTHROPIC_API_KEY and LASTFM_API_KEY in .env, and
// pnpm db:up; uses the dev database's cache)
import { mkdir, writeFile } from "node:fs/promises";
import { getArtist } from "../server/cache/lastfm";
import { getCachedArtistTrack } from "../server/cache/tracks";
import { getDb } from "../server/db/client";
import { createItunesClient } from "../server/itunes/client";
import { createLastfmClient } from "../server/lastfm/client";
import { REASONS_MODEL, createReasonsWriter } from "../server/llm/reasons-writer";
import { getRecommendations } from "../server/services/recommendations";
import { parseLastfmEnv, parseLlmEnv } from "../server/utils/env";
import type { ReasonsInput } from "../server/utils/reasons-prompt";

const outDir = new URL("../server/llm/fixtures/", import.meta.url);

// Well-known, mixed and lesser-known seeds, to see whether it stays specific or says null
const seedSets = [["Tame Impala"], ["Kokoroko"], ["Khruangbin", "Mitski"], ["Radiohead"], ["Nubya Garcia"], ["Big Thief"]];

const { apiKey } = parseLlmEnv();
if (!apiKey) throw new Error("Set ANTHROPIC_API_KEY in .env first");
const db = getDb();
const deps = {
  db,
  lastfm: createLastfmClient({ apiKey: parseLastfmEnv().LASTFM_API_KEY }),
  itunes: createItunesClient(),
  now: new Date(),
};

let recorded: unknown = null;
const recordingFetch = async (input: string | URL | Request, init?: RequestInit) => {
  const res = await fetch(input, init);
  recorded ??= { status: res.status, body: await res.clone().json() };
  return res;
};
const writer = createReasonsWriter({ apiKey, fetch: recordingFetch });

await mkdir(outDir, { recursive: true });
for (const [i, seeds] of seedSets.entries()) {
  const list = await getRecommendations(deps, { seeds, previews: "cached" });
  const input: ReasonsInput = {
    seeds: await Promise.all(list.seeds.map(async (name) => ({ name, tags: (await getArtist(deps, name)).tags.slice(0, 5) }))),
    records: await Promise.all(
      list.recommendations.map(async (r) => ({
        artist: r.artist,
        sources: r.sources,
        track: (await getCachedArtistTrack(deps, r.artist))?.title ?? null,
      })),
    ),
  };
  const output = await writer.write(input);
  console.log(`\n## ${seeds.join(" + ")} (${REASONS_MODEL})`);
  for (const { artist, reason } of output.reasons) console.log(`- ${artist}: ${reason ?? "(null)"}`);
  if (i === 0) {
    await writeFile(new URL("reasons-tame-impala.json", outDir), JSON.stringify({ input, response: recorded }, null, 2) + "\n");
  }
}
await db.$client.end();
