import { sql } from "drizzle-orm";
import { check, integer, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Drizzle schema。資料表依 SPEC.md「資料模型」逐一加入，每張表先有用到它的測試。

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// 匿名訪客。id 由伺服器產生後放進 cookie，所以不用資料庫的自動編號；
// 刻意不存 IP、User-Agent：除了這個隨機 ID 之外沒有任何可識別的資料
export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey(),
  createdAt: createdAt(),
});

// Last.fm 歌手的快取。fetched_at 超過 30 天就重抓
export const artists = pgTable(
  "artists",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // 顯示用，保留 Last.fm 給的大小寫
    name: text("name").notNull(),
    // 比對用：「Radiohead」「radiohead 」都算同一位
    nameNorm: text("name_norm").notNull().unique(),
    // MusicBrainz ID；很多冷門歌手沒有，所以不能當主鍵
    mbid: text("mbid"),
    listeners: integer("listeners"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // 相似歌手是另一個 API，分開記時間；null = 還沒抓過
    similarFetchedAt: timestamp("similar_fetched_at", { withTimezone: true }),
  },
  (t) => [check("artists_listeners_non_negative", sql`${t.listeners} >= 0`)],
);

// Last.fm 的相似歌手清單，屬於某位歌手；整份清單一起過期、一起換新
// 相似的那一方只存名字和 match，不指向 artists：它的聽眾數、標籤要用到時才抓，避免一次多打幾十次 API
export const artistSimilar = pgTable(
  "artist_similar",
  {
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(),
    mbid: text("mbid"),
    match: real("match").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.artistId, t.nameNorm] }),
    check("artist_similar_match_range", sql`${t.match} between 0 and 1`),
  ],
);
