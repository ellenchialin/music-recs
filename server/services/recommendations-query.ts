import { z } from "zod";

// ?seed=Tame%20Impala&seed=Kokoroko&exclude=Pond. h3 gives a string for one value and an array
// for several; normalize to arrays
const artistName = z.string().trim().min(1).max(200);
const oneOrMany = z.union([artistName, z.array(artistName)]).transform((v) => (Array.isArray(v) ? v : [v]));

export const recommendationsQuery = z.object({
  // Same 1–3 as app/stores/seeds.ts
  seed: oneOrMany.pipe(z.array(z.string()).min(1).max(3)),
  // Seeds plus artists shown on earlier levels: 3 + 10 × 3 levels fits well within 60
  exclude: oneOrMany.pipe(z.array(z.string()).max(60)).default([]),
}).transform(({ seed, exclude }) => ({ seeds: seed, exclude }));
