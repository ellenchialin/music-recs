import type { ArtistSearchResult } from "../lastfm/schemas";

export type ArtistSuggestion = { name: string; listeners: number };

// Below this it's usually a misspelled duplicate ("radıohead" has 117 listeners)
const MIN_LISTENERS = 1000;

// Key for spotting lookalikes: strip accents (é → e, İ → I), treat dotless ı as i, lowercase, collapse spaces.
// Only for comparing; the displayed name is unchanged
function lookalikeKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Last.fm search results → autocomplete and "did you mean" suggestions.
// Keeps Last.fm's relevance order; among lookalikes keeps the one with the most listeners
export function toArtistSuggestions(results: ArtistSearchResult[], limit = 8): ArtistSuggestion[] {
  const byKey = new Map<string, ArtistSuggestion>();
  for (const { name, listeners } of results) {
    if (listeners < MIN_LISTENERS) continue;
    const key = lookalikeKey(name);
    const existing = byKey.get(key);
    // Map keeps the first insertion position even when the value is replaced
    if (!existing || listeners > existing.listeners) byKey.set(key, { name, listeners });
  }
  return [...byKey.values()].slice(0, limit);
}
