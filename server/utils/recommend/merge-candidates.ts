import type { Candidate, SeedSimilarity } from "./types";

// Merges every seed's similar list into one ranked candidate list (Reciprocal Rank Fusion):
// rank r in a seed's list scores weight / (RANK_K + r), summed across seeds.
// Ranks instead of raw match (v1) so every seed's #1 counts the same. Ties sort by name

// Higher K flattens rank differences and favors artists shared by several seeds.
// With 5, #5 in two lists (2/10) beats #1 in one (1/6); #10 in two (2/15) lands between #2 and #3
export const RANK_K = 5;

export function mergeCandidates(seeds: SeedSimilarity[]): Candidate[] {
  const byName = new Map<string, Candidate>();

  for (const { seed, weight, similar } of seeds) {
    // Rank by match, not input order; name breaks ties so ranks are stable
    const ranked = [...similar].sort((a, b) => b.match - a.match || a.nameNorm.localeCompare(b.nameNorm));
    for (const [index, artist] of ranked.entries()) {
      const candidate = byName.get(artist.nameNorm) ?? {
        name: artist.name,
        nameNorm: artist.nameNorm,
        mbid: artist.mbid,
        score: 0,
        sources: [],
      };
      candidate.score += weight / (RANK_K + index + 1);
      if (!candidate.sources.includes(seed)) candidate.sources.push(seed);
      byName.set(artist.nameNorm, candidate);
    }
  }

  return [...byName.values()]
    .map((c) => ({ ...c, score: roundScore(c.score) }))
    .sort((a, b) => b.score - a.score || a.nameNorm.localeCompare(b.nameNorm));
}

// Float sums depend on order (1/7 + 1/8 may differ from 1/8 + 1/7), so round before sorting
// and let the name break the tie. Real score gaps are far larger than 1e-6
function roundScore(score: number): number {
  return Math.round(score * 1e6) / 1e6;
}
