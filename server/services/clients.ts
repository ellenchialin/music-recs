import { createItunesClient } from "../itunes/client";
import { createLastfmClient } from "../lastfm/client";
import { parseLastfmEnv } from "../utils/env";

// 正式環境用的 client，第一次用到才建立（和 db/client.ts 的 getDb 一樣）
// 測試不經過這裡，直接把假的 client 傳給 service

let lastfm: ReturnType<typeof createLastfmClient> | undefined;
let itunes: ReturnType<typeof createItunesClient> | undefined;

export function getLastfmClient() {
  lastfm ??= createLastfmClient({ apiKey: parseLastfmEnv().LASTFM_API_KEY });
  return lastfm;
}

export function getItunesClient() {
  itunes ??= createItunesClient();
  return itunes;
}
