import type { LocationQuery, RouteLocationRaw } from "vue-router";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { MAX_SEEDS } from "~/stores/seeds";
import { MAX_EXPLORE_DEPTH } from "./explore-trail";

// /recommendations?seed=Tame%20Impala&seed=Kokoroko&explore=Pond&explore=GUM
// The URL is the source of truth for recommendations, so back, reload and shared links all work

export type RecommendationsQuery = { seeds: string[]; explore: string[] };

// A query value can be a string, an array or null
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

// URLs can be hand-edited: ignore extras rather than break. null without seeds
export function parseRecommendationsQuery(query: LocationQuery): RecommendationsQuery | null {
  const seeds = unique(names(query.seed)).slice(0, MAX_SEEDS);
  if (!seeds.length) return null;
  return { seeds, explore: names(query.explore).slice(0, MAX_EXPLORE_DEPTH) };
}

export function recommendationsLocation(seeds: string[], explore: string[] = []): RouteLocationRaw {
  return { path: "/recommendations", query: explore.length ? { seed: seeds, explore } : { seed: seeds } };
}

// Home with the seeds, so the input shows them for editing
export function homeLocation(seeds: string[]): RouteLocationRaw {
  return { path: "/", query: { seed: seeds } };
}

// The Taste Check (a blind test) for the same seeds
export function tasteCheckLocation(seeds: string[]): RouteLocationRaw {
  return { path: "/taste-check", query: { seed: seeds } };
}

export function seedsLabel(seeds: string[]): string {
  return seeds.join(" + ");
}
