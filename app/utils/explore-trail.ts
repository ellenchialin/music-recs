import type { RecommendationsResult } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";

// The Explore path (seeds › Pond › GUM). Each level keeps the artist it came from (null for the
// user's seeds), its result, and the record being viewed. Pure functions; arrays are never mutated

export const MAX_EXPLORE_DEPTH = 3;

export type TrailLevel = { artist: string | null; result: RecommendationsResult; index: number };
export type Trail = TrailLevel[];

// Level 0 doesn't count toward MAX_EXPLORE_DEPTH
export function canExplore(trail: Trail): boolean {
  return trail.length - 1 < MAX_EXPLORE_DEPTH;
}

export function exploreFrom(trail: Trail, artist: string, result: RecommendationsResult): Trail {
  return [...trail, { artist, result, index: 0 }];
}

// Seeds plus every record shown so far, so each level shows new artists
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

export function backTo(trail: Trail, level: number): Trail {
  return trail.slice(0, level + 1);
}
