// 打真的 Last.fm API，把回應存成測試用的 fixture。只在 API 格式可能變了、或需要新案例時手動跑：
//   pnpm record:lastfm
// 測試只讀這些檔案，不打網路。回應裡不含 API key（存檔前會檢查）
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
  // 找不到的歌手：確認錯誤長什麼樣
  { file: "similar-not-found", params: { method: "artist.getSimilar", artist: "zzqx no such artist 4821" } },
];

await mkdir(outDir, { recursive: true });

for (const { file, params } of cases) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.search = new URLSearchParams({ ...params, api_key: LASTFM_API_KEY, format: "json" }).toString();
  const res = await fetch(url);
  const text = await res.text();
  if (text.includes(LASTFM_API_KEY)) throw new Error(`${file}: response contains the API key, not saving`);

  // 連 HTTP 狀態一起存：錯誤的時候 Last.fm 可能回 4xx，也可能回 200 + error 欄位
  const fixture = { status: res.status, body: JSON.parse(text) as unknown };
  await writeFile(new URL(`${file}.json`, outDir), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${file}: HTTP ${res.status}`);
}
