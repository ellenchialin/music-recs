import { z } from "zod";

// GET /api/recommendations 的 query string：?seed=Tame%20Impala&seed=Kokoroko&exclude=Pond
// h3 的 getQuery：同一個參數一個時是字串，兩個以上是陣列，這裡統一成陣列
const artistName = z.string().trim().min(1).max(200);
const oneOrMany = z.union([artistName, z.array(artistName)]).transform((v) => (Array.isArray(v) ? v : [v]));

export const recommendationsQuery = z.object({
  // 種子 1–3 位，和前端的 stores/seeds.ts 一樣
  seed: oneOrMany.pipe(z.array(z.string()).min(1).max(3)),
  // Explore from here 往下挖時要排除的歌手：原本的種子、前面各層看過的。
  // 最多挖 3 層（種子 3 位 ＋ 每層 10 張 × 3 層），60 位綽綽有餘
  exclude: oneOrMany.pipe(z.array(z.string()).max(60)).default([]),
}).transform(({ seed, exclude }) => ({ seeds: seed, exclude }));
