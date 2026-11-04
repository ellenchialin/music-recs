import type { RecommendationsResult } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";

// Explore from here 的路徑：Your artists › Pond › GUM
// 每一層記住從哪位歌手挖下來（第一層是 null，代表使用者選的種子）、推薦結果、當時看到第幾張。
// 都是純函式、不改原本的陣列：回上一層時，前面各層原封不動

export const MAX_EXPLORE_DEPTH = 3;

export type TrailLevel = { artist: string | null; result: RecommendationsResult; index: number };
export type Trail = TrailLevel[];

// 第一層不算：最多再往下挖 MAX_EXPLORE_DEPTH 次
export function canExplore(trail: Trail): boolean {
  return trail.length - 1 < MAX_EXPLORE_DEPTH;
}

export function exploreFrom(trail: Trail, artist: string, result: RecommendationsResult): Trail {
  return [...trail, { artist, result, index: 0 }];
}

// 下一層要排除的歌手：原本的種子 ＋ 每一層顯示過的唱片，讓每往下挖一層都是新面孔。
// 往下挖的那位本來就是上一層的唱片，不用另外加。名字寫法不同算同一位，不重複
export function excludedFor(trail: Trail, seeds: string[]): string[] {
  const names = [...seeds, ...trail.flatMap((level) => level.result.recommendations.map((c) => c.artist))];
  const seen = new Set<string>();
  return names.filter((name) => {
    const key = normalizeArtistName(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 點路徑回到第 level 層（0 = 第一層）：後面的層丟掉，那一層看到第幾張保留
export function backTo(trail: Trail, level: number): Trail {
  return trail.slice(0, level + 1);
}
