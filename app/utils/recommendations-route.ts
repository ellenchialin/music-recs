import type { LocationQuery, RouteLocationRaw } from "vue-router";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { DEFAULT_POPULARITY, POPULARITY_SETTINGS, type Popularity } from "~~/shared/types/popularity";
import { MAX_SEEDS } from "~/stores/seeds";
import { MAX_EXPLORE_DEPTH } from "./explore-trail";

// /recommendations?seed=Tame%20Impala&seed=Kokoroko&explore=Pond&explore=GUM&popularity=obscure
// The URL is the source of truth for recommendations, so back, reload and shared links all work

export type RecommendationsQuery = { seeds: string[]; explore: string[]; popularity: Popularity };

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
  return { seeds, explore: names(query.explore).slice(0, MAX_EXPLORE_DEPTH), popularity: popularityOf(query.popularity) };
}

function popularityOf(value: LocationQuery[string] | undefined): Popularity {
  return POPULARITY_SETTINGS.find((setting) => setting === value) ?? DEFAULT_POPULARITY;
}

// Left out of the URL in the middle, so links from before the slider stay the same
const popularityQuery = (popularity: Popularity) => (popularity === DEFAULT_POPULARITY ? {} : { popularity });

export function recommendationsLocation(
  seeds: string[],
  explore: string[] = [],
  popularity: Popularity = DEFAULT_POPULARITY,
): RouteLocationRaw {
  return { path: "/recommendations", query: { seed: seeds, ...(explore.length ? { explore } : {}), ...popularityQuery(popularity) } };
}

// Home with the seeds, so the input shows them for editing
export function homeLocation(seeds: string[]): RouteLocationRaw {
  return { path: "/", query: { seed: seeds } };
}

// The Taste Check (a blind test) for the same seeds
export function tasteCheckLocation(seeds: string[], popularity: Popularity = DEFAULT_POPULARITY): RouteLocationRaw {
  return { path: "/taste-check", query: { seed: seeds, ...popularityQuery(popularity) } };
}

// Everyone's results. The seeds only lead back: the numbers are the same for every visitor
export function resultsLocation(seeds: string[], popularity: Popularity = DEFAULT_POPULARITY): RouteLocationRaw {
  return { path: "/stats", query: seeds.length ? { seed: seeds, ...popularityQuery(popularity) } : {} };
}

export function seedsLabel(seeds: string[]): string {
  return seeds.join(" + ");
}
