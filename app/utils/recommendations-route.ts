import type { LocationQuery, RouteLocationRaw } from "vue-router";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { MAX_SEEDS } from "~/stores/seeds";
import { MAX_EXPLORE_DEPTH } from "./explore-trail";

// /recommendations?seed=Tame%20Impala&seed=Kokoroko&explore=Pond&explore=GUM
// 網址是推薦結果的唯一來源：種子和往下挖的路徑都在這裡，上一頁、重新整理、分享連結都看到同一個畫面

export type RecommendationsQuery = { seeds: string[]; explore: string[] };

// query 的值可能是字串、陣列或 null（Vue Router 的寫法），統一成去掉空白、空字串的陣列
function names(value: LocationQuery[string] | undefined): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((v) => (typeof v === "string" && v.trim() ? [v.trim()] : []));
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((name) => {
    const key = normalizeArtistName(name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 網址可以手改：多的種子、太深的路徑都忽略，不讓整頁壞掉；沒有種子回 null
export function parseRecommendationsQuery(query: LocationQuery): RecommendationsQuery | null {
  const seeds = unique(names(query.seed)).slice(0, MAX_SEEDS);
  if (!seeds.length) return null;
  return { seeds, explore: names(query.explore).slice(0, MAX_EXPLORE_DEPTH) };
}

export function recommendationsLocation(seeds: string[], explore: string[] = []): RouteLocationRaw {
  return { path: "/recommendations", query: explore.length ? { seed: seeds, explore } : { seed: seeds } };
}

// 麵包屑的 Home：帶著種子回首頁，輸入框裡就是這組種子，可以接著改
export function homeLocation(seeds: string[]): RouteLocationRaw {
  return { path: "/", query: { seed: seeds } };
}

export function seedsLabel(seeds: string[]): string {
  return seeds.join(" + ");
}
