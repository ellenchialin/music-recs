import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tracks } from "../db/schema";
import type { ItunesClient } from "../itunes/client";
import type { ItunesTrack } from "../itunes/schemas";
import type { LastfmClient } from "../lastfm/client";
import { isFresh } from "../utils/is-fresh";
import { normalizeArtistName } from "../utils/normalize-artist-name";
import { pickTrack } from "../utils/pick-track";

// 每位歌手的代表歌快取：Last.fm 熱門第一名 → 依序搜 iTunes 各國商店 → pickTrack 挑試聽和封面
// 和 lastfm.ts 一樣是 cache-aside，依賴都從參數傳入

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getTopTracks">;
  itunes: Pick<ItunesClient, "searchTracks">;
  now: Date;
};

export type ArtistTrack = typeof tracks.$inferSelect;

// 各國商店會把歌手名翻成當地寫法（台灣：BoA → 寶兒；日本：Radiohead → レディオヘッド），
// 沒有一個商店能全部對上，所以依序試。台灣優先（使用者在台灣），再來美國、日本
const ITUNES_STORES = ["TW", "US", "JP"];

// artistName 用 Last.fm 的寫法（推薦清單裡的相似歌手名）
export async function getArtistTrack({ db, lastfm, itunes, now }: Deps, artistName: string): Promise<ArtistTrack | null> {
  const artistNameNorm = normalizeArtistName(artistName);
  const [cached] = await db.select().from(tracks).where(eq(tracks.artistNameNorm, artistNameNorm));
  if (cached && isFresh(cached.fetchedAt, now)) return cached;

  const [top] = await lastfm.getTopTracks(artistName, { limit: 1 });
  // 沒有熱門歌就沒有歌名可以搜。很少見，不存：下次再問一次 Last.fm 就好
  if (!top) return null;

  // 挑到就停，省下速率限制的額度。任何一個商店出錯（速率限制、當機）都會在這裡丟錯，什麼都不存；
  // 三個商店都正常回應、都挑不到，才存一列試聽是 null 的資料
  let picked: ItunesTrack | null = null;
  for (const country of ITUNES_STORES) {
    const results = await itunes.searchTracks(`${artistName.trim()} ${top.name}`, { country });
    picked = pickTrack(results, { artist: artistName, title: top.name });
    if (picked) break;
  }

  const values = {
    artistName: artistName.trim(),
    title: top.name,
    itunesId: picked?.id ?? null,
    previewUrl: picked?.previewUrl ?? null,
    artworkUrl: picked?.artworkUrl ?? null,
    fetchedAt: now,
  };
  const [row] = await db
    .insert(tracks)
    .values({ ...values, artistNameNorm })
    .onConflictDoUpdate({ target: tracks.artistNameNorm, set: values })
    .returning();
  return row!;
}
