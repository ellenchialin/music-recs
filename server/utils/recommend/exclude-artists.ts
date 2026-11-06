import type { Candidate, ExcludedArtist } from "./types";

// Removes excluded artists, keeping the order. Same normalized name or same MBID counts as a match
export function excludeArtists(candidates: Candidate[], excluded: ExcludedArtist[]): Candidate[] {
  const names = new Set(excluded.map((e) => e.nameNorm));
  // Leave out nulls: two artists without an MBID are not the same artist
  const mbids = new Set(excluded.flatMap((e) => (e.mbid ? [e.mbid] : [])));

  return candidates.filter((c) => !names.has(c.nameNorm) && !(c.mbid && mbids.has(c.mbid)));
}
