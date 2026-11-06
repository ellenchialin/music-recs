// Records real iTunes Search API responses as test fixtures. Run by hand when the API may have
// changed or a new case is needed: pnpm record:itunes
import { mkdir, writeFile } from "node:fs/promises";

const outDir = new URL("../server/itunes/fixtures/", import.meta.url);

const cases: { file: string; params: Record<string, string> }[] = [
  // The first hit is the acoustic version, not the original
  { file: "search-radiohead-creep", params: { term: "Radiohead Creep", entity: "song", limit: "5", country: "TW" } },
  // The TW store says "Hikaru Utada"; Last.fm says 「宇多田ヒカル」
  { file: "search-utada-first-love", params: { term: "宇多田ヒカル First Love", entity: "song", limit: "5", country: "TW" } },
  { file: "search-no-results", params: { term: "zzqxnosuchsong4821", entity: "song", country: "TW" } },
  // Bad parameter: HTTP 400 with errorMessage
  { file: "search-bad-request", params: { term: "x", entity: "nonsense" } },
];

await mkdir(outDir, { recursive: true });

for (const { file, params } of cases) {
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url);
  const fixture = { status: res.status, body: (await res.json()) as unknown };
  await writeFile(new URL(`${file}.json`, outDir), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${file}: HTTP ${res.status}`);
}
