import type { ArtistSearchResult } from "../lastfm/schemas";
import { lookalikeKey } from "../../shared/utils/lookalike-key";

export type ArtistSuggestion = { name: string; listeners: number };

// Below this it's usually a misspelled duplicate ("radıohead" has 117 listeners)
const MIN_LISTENERS = 1000;

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
