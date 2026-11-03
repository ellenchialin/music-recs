// 打真的 iTunes Search API，把回應存成測試用的 fixture。只在 API 格式可能變了、或需要新案例時手動跑：
//   pnpm record:itunes
// iTunes 不需要 API key。測試只讀這些檔案，不打網路
import { mkdir, writeFile } from "node:fs/promises";

const outDir = new URL("../server/itunes/fixtures/", import.meta.url);

const cases: { file: string; params: Record<string, string> }[] = [
  // 第一筆是 Acoustic 版，不是原版：挑歌時要處理
  { file: "search-radiohead-creep", params: { term: "Radiohead Creep", entity: "song", limit: "5", country: "TW" } },
  // 台灣商店的歌手名是羅馬拼音「Hikaru Utada」，Last.fm 是「宇多田ヒカル」
  { file: "search-utada-first-love", params: { term: "宇多田ヒカル First Love", entity: "song", limit: "5", country: "TW" } },
  { file: "search-no-results", params: { term: "zzqxnosuchsong4821", entity: "song", country: "TW" } },
  // 參數錯誤：HTTP 400 + errorMessage
  { file: "search-bad-request", params: { term: "x", entity: "nonsense" } },
];

await mkdir(outDir, { recursive: true });

for (const { file, params } of cases) {
  const url = new URL("https://itunes.apple.com/search");
  url.search = new URLSearchParams(params).toString();
  const res = await fetch(url);
  // 連 HTTP 狀態一起存：錯誤時 iTunes 回 4xx + errorMessage
  const fixture = { status: res.status, body: (await res.json()) as unknown };
  await writeFile(new URL(`${file}.json`, outDir), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${file}: HTTP ${res.status}`);
}
