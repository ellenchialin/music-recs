// Records real Last.fm responses as test fixtures. Run by hand when the API may have changed or a
// new case is needed: pnpm record:lastfm. Responses are checked for the API key before saving
import { mkdir, writeFile } from "node:fs/promises";
import { parseLastfmEnv } from "../server/utils/env";

const { LASTFM_API_KEY } = parseLastfmEnv();
const outDir = new URL("../server/lastfm/fixtures/", import.meta.url);

const cases: { file: string; params: Record<string, string> }[] = [
  { file: "search-radiohead", params: { method: "artist.search", artist: "radiohead", limit: "5" } },
  { file: "similar-radiohead", params: { method: "artist.getSimilar", artist: "Radiohead", limit: "10", autocorrect: "1" } },
  { file: "toptags-radiohead", params: { method: "artist.getTopTags", artist: "Radiohead", autocorrect: "1" } },
  { file: "toptracks-radiohead", params: { method: "artist.getTopTracks", artist: "Radiohead", limit: "5", autocorrect: "1" } },
  { file: "info-radiohead", params: { method: "artist.getInfo", artist: "Radiohead", autocorrect: "1" } },
  { file: "similar-not-found", params: { method: "artist.getSimilar", artist: "zzqx no such artist 4821" } },
  { file: "topartists-psychedelic", params: { method: "tag.getTopArtists", tag: "psychedelic", limit: "5" } },
];
// pnpm record:lastfm <file> re-records just that case and leaves the other fixtures alone
const only = process.argv[2];

await mkdir(outDir, { recursive: true });

for (const { file, params } of cases.filter((c) => !only || c.file === only)) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.search = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: "json" }).toString();
  const res = await fetch(url);
  const text = await res.text();
  if (text.includes(LASTFM_API_KEY)) throw new Error(`${file}: response contains the API key, not saving`);

  // Keep the status: Last.fm errors can be 4xx or 200 with an `error` field
  const fixture = { status: res.status, body: JSON.parse(text) as unknown };
  await writeFile(new URL(`${file}.json`, outDir), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${file}: HTTP ${res.status}`);
}
