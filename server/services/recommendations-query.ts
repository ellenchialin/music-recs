import { z } from "zod";

// GET /api/recommendations 的 query string：?seed=Tame%20Impala&seed=Kokoroko
// h3 的 getQuery：一個 seed 時是字串，兩個以上是陣列，這裡統一成陣列
const seedName = z.string().trim().min(1).max(200);

export const recommendationsQuery = z
  .object({ seed: z.union([seedName, z.array(seedName)]) })
  // 種子 1–3 位，和前端的 stores/seeds.ts 一樣
  .transform(({ seed }) => ({ seeds: Array.isArray(seed) ? seed : [seed] }))
  .pipe(z.object({ seeds: z.array(z.string()).min(1).max(3) }));
