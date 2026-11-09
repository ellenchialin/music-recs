import { z } from "zod";

// Validates Last.fm responses and reshapes them: only the fields we use, numeric strings to numbers, "" to null

// Numbers are usually strings ("8500398"), sometimes numbers
const count = z.coerce.number().int().nonnegative();

// A missing MBID is ""
const mbid = z
  .string()
  .optional()
  .transform((s) => (s ? s : null));

// The JSON comes from XML: one item becomes an object instead of an array, and none may drop the key
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

const tagArtist = z.object({ name: z.string().min(1), mbid }).transform(({ name, mbid }) => ({ name, mbid }));

export const tagTopArtistsResponse = z
  .object({ topartists: z.object({ artist: list(tagArtist) }) })
  .transform((r) => r.topartists.artist);

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

// e.g. { "error": 6, "message": "The artist you supplied could not be found" }
export const errorResponse = z.object({ error: z.number().int(), message: z.string() });

export type ArtistSearchResult = z.output<typeof artistSearchResponse>[number];
export type SimilarArtist = z.output<typeof similarArtistsResponse>[number];
export type ArtistTag = z.output<typeof topTagsResponse>[number];
export type TopTrack = z.output<typeof topTracksResponse>[number];
export type ArtistInfo = z.output<typeof artistInfoResponse>;
