import { z } from "zod";

// Last.fm 回應的 zod schema。每個 schema 同時做兩件事：
// 1. 驗證：格式不對就丟錯，不讓壞資料流進推薦演算法
// 2. 轉換：只留需要的欄位、字串數字轉成 number、"" 轉成 null

// Last.fm 的數字幾乎都是字串（"8500398"），偶爾是 number（tag 的 count）
const count = z.coerce.number().int().nonnegative();

// 沒有 MBID 時是空字串
const mbid = z
  .string()
  .optional()
  .transform((s) => (s ? s : null));

// JSON 是從 XML 轉來的：只有一筆時陣列會變成單一物件，沒有資料時可能整個不見
function list<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), item])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]));
}

const searchArtist = z
  .object({ name: z.string().min(1), mbid, listeners: count })
  .transform(({ name, mbid, listeners }) => ({ name, mbid, listeners }));

export const artistSearchResponse = z
  .object({ results: z.object({ artistmatches: z.object({ artist: list(searchArtist) }) }) })
  .transform((r) => r.results.artistmatches.artist);

const similarArtist = z
  .object({ name: z.string().min(1), mbid, match: z.coerce.number().min(0).max(1) })
  .transform(({ name, mbid, match }) => ({ name, mbid, match }));

export const similarArtistsResponse = z
  .object({ similarartists: z.object({ artist: list(similarArtist) }) })
  .transform((r) => r.similarartists.artist);

const tag = z
  .object({ name: z.string().min(1), count })
  .transform(({ name, count }) => ({ name, count }));

export const topTagsResponse = z
  .object({ toptags: z.object({ tag: list(tag) }) })
  .transform((r) => r.toptags.tag);

const topTrack = z
  .object({ name: z.string().min(1), mbid, playcount: count, listeners: count })
  .transform(({ name, mbid, playcount, listeners }) => ({ name, mbid, playcount, listeners }));

export const topTracksResponse = z
  .object({ toptracks: z.object({ track: list(topTrack) }) })
  .transform((r) => r.toptracks.track);

export const artistInfoResponse = z
  .object({
    artist: z.object({
      name: z.string().min(1),
      mbid,
      stats: z.object({ listeners: count }),
      tags: z.object({ tag: list(z.object({ name: z.string().min(1) })) }).optional(),
    }),
  })
  .transform(({ artist }) => ({
    name: artist.name,
    mbid: artist.mbid,
    listeners: artist.stats.listeners,
    tags: (artist.tags?.tag ?? []).map((t) => t.name),
  }));

// 錯誤回應：{ "error": 6, "message": "The artist you supplied could not be found" }
export const errorResponse = z.object({ error: z.number().int(), message: z.string() });

export type ArtistSearchResult = z.output<typeof artistSearchResponse>[number];
export type SimilarArtist = z.output<typeof similarArtistsResponse>[number];
export type ArtistTag = z.output<typeof topTagsResponse>[number];
export type TopTrack = z.output<typeof topTracksResponse>[number];
export type ArtistInfo = z.output<typeof artistInfoResponse>;
