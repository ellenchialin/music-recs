import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { artistSimilar, artists } from "../db/schema";
import type { LastfmClient } from "../lastfm/client";
import { isFresh } from "../utils/is-fresh";
import { normalizeArtistName } from "../utils/normalize-artist-name";

// Last.fm 資料的快取：先查 Postgres，沒有或過期才打 API，再寫回去（cache-aside）
// 依賴都從參數傳入：測試傳假的 Last.fm client 和固定的「現在」

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar">;
  now: Date;
};

export type Artist = typeof artists.$inferSelect;
export type CachedSimilarArtist = Omit<typeof artistSimilar.$inferSelect, "artistId">;

// 相似清單抓幾筆：推薦需要夠多候選，扣掉種子、不喜歡的歌手後還要剩 10 位以上
const SIMILAR_LIMIT = 50;

export async function getArtist({ db, lastfm, now }: Deps, name: string): Promise<Artist> {
  const [cached] = await db
    .select()
    .from(artists)
    .where(eq(artists.nameNorm, normalizeArtistName(name)));
  if (cached && isFresh(cached.fetchedAt, now)) return cached;

  // 找不到歌手時 getInfo 會丟 LastfmError，直接往上丟，不寫任何東西
  const info = await lastfm.getInfo(name);
  const values = {
    name: info.name,
    mbid: info.mbid,
    listeners: info.listeners,
    tags: info.tags,
    fetchedAt: now,
  };

  // upsert：兩個請求同時查同一位新歌手時，後寫的那個變成更新，不會撞 unique 錯誤
  // 用 Last.fm 回傳的名字當 key（autocorrect 後的正式寫法），不是使用者輸入的
  const [row] = await db
    .insert(artists)
    .values({ ...values, nameNorm: normalizeArtistName(info.name) })
    .onConflictDoUpdate({ target: artists.nameNorm, set: values })
    .returning();
  return row!;
}

export async function getSimilarArtists({ db, lastfm, now }: Deps, artist: Artist): Promise<CachedSimilarArtist[]> {
  if (!isFresh(artist.similarFetchedAt, now)) {
    const similar = await lastfm.getSimilar(artist.name, { limit: SIMILAR_LIMIT });
    const rows = similar
      .map((a) => ({ artistId: artist.id, name: a.name, nameNorm: normalizeArtistName(a.name), mbid: a.mbid, match: a.match }))
      // 先依 match 排好：正規化後重複時，留下來的是排在前面（match 高）的那個
      .sort((a, b) => b.match - a.match);

    // 刪舊、寫新、記時間要一起成功或一起失敗，不然可能留下「時間更新了、清單是空的」
    await db.transaction(async (tx) => {
      await tx.delete(artistSimilar).where(eq(artistSimilar.artistId, artist.id));
      if (rows.length > 0) await tx.insert(artistSimilar).values(rows).onConflictDoNothing();
      await tx.update(artists).set({ similarFetchedAt: now }).where(eq(artists.id, artist.id));
    });
  }

  return db
    .select({ name: artistSimilar.name, nameNorm: artistSimilar.nameNorm, mbid: artistSimilar.mbid, match: artistSimilar.match })
    .from(artistSimilar)
    .where(eq(artistSimilar.artistId, artist.id))
    .orderBy(desc(artistSimilar.match), asc(artistSimilar.nameNorm));
}
