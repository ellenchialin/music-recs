import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";
import { excludeArtists } from "./exclude-artists";
import { mergeCandidates } from "./merge-candidates";
import type { Candidate, ExcludedArtist, SeedSimilarity } from "./types";

// Bump whenever the ranking rules change: blind-test ratings are stored with the version.
// v1: summed match. v2: summed rank scores (Reciprocal Rank Fusion)
export const ALGO_VERSION = "v2";

const DEFAULT_LIMIT = 10;

// Merge → exclude → take the top N
export function recommend({
  seeds,
  exclude = [],
  limit = DEFAULT_LIMIT,
}: {
  seeds: SeedSimilarity[];
  // When exploring: the original seeds and artists shown on earlier levels
  exclude?: ExcludedArtist[];
  limit?: number;
}): { algoVersion: string; artists: Candidate[] } {
  const seedsAsExcluded = seeds.map((s) => ({ nameNorm: normalizeArtistName(s.seed), mbid: s.seedMbid }));

  const candidates = excludeArtists(mergeCandidates(seeds), [...seedsAsExcluded, ...exclude]);

  // Exclude before slicing so the list is still full
  return { algoVersion: ALGO_VERSION, artists: candidates.slice(0, limit) };
}
