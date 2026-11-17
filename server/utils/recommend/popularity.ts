import type { Popularity } from "../../../shared/types/popularity";
import { RANK_K } from "./merge-candidates";
import type { Candidate } from "./types";

// The mainstream ↔ obscure slider: re-orders the most similar candidates by how many listeners
// they have. Ranks again rather than raw counts (as in merge-candidates.ts), so Coldplay's
// millions don't drown everything else: each candidate scores
//   1 / (K + similarity rank) + WEIGHT / (K + popularity rank)
// where popularity rank 1 is the most listeners (mainstream) or the fewest (obscure)

// How many of the most similar candidates the slider chooses among. Small enough to look up each
// one's listener count, large enough for the top 10 to change
export const POPULARITY_POOL = 30;

// Popularity counts double: at 1, swapping two artists' similarity and popularity ranks is an
// exact tie and the slider barely moves anything. The pool is already the most similar artists
const POPULARITY_WEIGHT = 2;

// candidates: most similar first. listeners: by nameNorm; null or missing when the lookup failed
export function rerankByPopularity(
  candidates: Candidate[],
  listeners: Map<string, number | null>,
  setting: Popularity,
): Candidate[] {
  if (setting === "balanced") return candidates;

  const direction = setting === "mainstream" ? -1 : 1;
  const known = candidates
    .map((candidate, similarityIndex) => ({ nameNorm: candidate.nameNorm, similarityIndex, count: listeners.get(candidate.nameNorm) }))
    .filter((c): c is typeof c & { count: number } => typeof c.count === "number")
    .sort((a, b) => direction * (a.count - b.count) || a.similarityIndex - b.similarityIndex);
  const popularityRank = new Map<string, number>();
  for (const [index, c] of known.entries()) {
    // Equal counts share a rank, so neither gets ahead of the other on popularity
    const previous = known[index - 1];
    popularityRank.set(c.nameNorm, previous?.count === c.count ? popularityRank.get(previous.nameNorm)! : index + 1);
  }

  return candidates
    .map((candidate, index) => {
      const rank = popularityRank.get(candidate.nameNorm);
      // No listener count: no popularity score at all, in either direction
      const combined = 1 / (RANK_K + index + 1) + (rank ? POPULARITY_WEIGHT / (RANK_K + rank) : 0);
      return { candidate, index, combined: Math.round(combined * 1e6) / 1e6 };
    })
    .sort((a, b) => b.combined - a.combined || a.index - b.index)
    .map((entry) => entry.candidate);
}
