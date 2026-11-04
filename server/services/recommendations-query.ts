import { z } from "zod";

// GET /api/recommendations 的 query string：?seed=Tame%20Impala&seed=Kokoroko
// h3 的 getQuery：一個 seed 時是字串，兩個以上是陣列，這裡統一成陣列
const seedName = z.string().trim().min(1).max(200);

export const recommendationsQuery = z
  .object({ seed: z.union([seedName, z.array(seedName)]) })
  // SPEC 是 3–5 位；API 接受 1–5 位方便測試，「至少 3 位」由前端要求
  .transform(({ seed }) => ({ seeds: Array.isArray(seed) ? seed : [seed] }))
  .pipe(z.object({ seeds: z.array(z.string()).min(1).max(5) }));
