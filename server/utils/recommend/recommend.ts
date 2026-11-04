import { normalizeArtistName } from "../normalize-artist-name";
import { excludeArtists } from "./exclude-artists";
import { mergeCandidates } from "./merge-candidates";
import type { Candidate, ExcludedArtist, SeedSimilarity } from "./types";

// 演算法版本：規則一改（例如加上冷門程度的權重）就換新版本，
// 盲聽測驗的評分會連同版本存下來，才比得出哪一版比較好
export const ALGO_VERSION = "v1";

const DEFAULT_LIMIT = 10;

// 推薦的入口：合併 → 排除 → 取前 N 位
export function recommend({
  seeds,
  disliked = [],
  limit = DEFAULT_LIMIT,
}: {
  seeds: SeedSimilarity[];
  disliked?: ExcludedArtist[];
  limit?: number;
}): { algoVersion: string; artists: Candidate[] } {
  // 種子本身一律排除，不靠呼叫的人記得傳
  const seedsAsExcluded = seeds.map((s) => ({ nameNorm: normalizeArtistName(s.seed), mbid: s.seedMbid }));

  const candidates = excludeArtists(mergeCandidates(seeds), [...seedsAsExcluded, ...disliked]);

  // 先排除再取前 N 位，排除掉的名額由後面的候選補上
  return { algoVersion: ALGO_VERSION, artists: candidates.slice(0, limit) };
}
