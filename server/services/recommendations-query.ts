import { z } from "zod";
import { DEFAULT_POPULARITY, POPULARITY_SETTINGS } from "../../shared/types/popularity";

// ?seed=Tame%20Impala&seed=Kokoroko&exclude=Pond. h3 gives a string for one value and an array
// for several; normalize to arrays
const artistName = z.string().trim().min(1).max(200);
const oneOrMany = z.union([artistName, z.array(artistName)]).transform((v) => (Array.isArray(v) ? v : [v]));

const listQuery = z.object({
  // Same 1–3 as app/stores/seeds.ts
  seed: oneOrMany.pipe(z.array(z.string()).min(1).max(3)),
  // Seeds plus artists shown on earlier levels: 3 + 10 × 3 levels fits well within 60
  exclude: oneOrMany.pipe(z.array(z.string()).max(60)).default([]),
  // The mainstream ↔ obscure slider
  popularity: z.enum(POPULARITY_SETTINGS).default(DEFAULT_POPULARITY),
});

export const recommendationsQuery = listQuery.transform(({ seed, exclude, popularity }) => ({ seeds: seed, exclude, popularity }));

// GET /api/reasons: the same list, plus the record on screen so its reason is written first.
// Only an ordering hint: an artist that isn't in the list changes nothing
export const reasonsQuery = listQuery
  .extend({ first: artistName.optional() })
  .transform(({ seed, exclude, popularity, first }) => ({ seeds: seed, exclude, popularity, first }));

// GET /api/previews?artist=Pond&artist=GUM: the previews of a page's records the list left
// "pending", nearest record first, in one request (or one artist, for a retry)
export const previewsQuery = z
  .object({ artist: oneOrMany.pipe(z.array(z.string()).min(1).max(10)) })
  .transform(({ artist }) => ({ artists: artist }));
