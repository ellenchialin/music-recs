import { normalizeArtistName } from "./normalize-artist-name";

// Autocomplete helpers shared by the server (merging Last.fm searches) and the page (merging our
// own instant matches with Last.fm's). Last.fm's search matches whole words only, so "hiatus kai"
// finds nothing; these let a half-typed last word still match

// listeners is null for names we only know from similar-artist lists
export type Suggestion = { name: string; listeners: number | null };

// Whether what's typed starts the name, or starts one of its words: "impala" → Tame Impala,
// "hiatus kai" → Hiatus Kaiyote, but not "head" → Radiohead
export function startsAWord(name: string, typed: string): boolean {
  const n = normalizeArtistName(name);
  const t = normalizeArtistName(typed);
  return t.length > 0 && (n.startsWith(t) || n.includes(` ${t}`));
}

// "hiatus kai" → "hiatus", to search for whole words; null when there's only one word
export function withoutLastWord(typed: string): string | null {
  const words = normalizeArtistName(typed).split(" ");
  return words.length > 1 ? words.slice(0, -1).join(" ") : null;
}

// first's order, then what second adds, without duplicates; a known listener count fills a missing one
export function mergeSuggestions<T extends Suggestion>(first: T[], second: T[], limit: number): T[] {
  const byKey = new Map<string, T>();
  for (const s of [...first, ...second]) {
    const key = normalizeArtistName(s.name);
    const existing = byKey.get(key);
    if (!existing) byKey.set(key, s);
    else if (existing.listeners === null && s.listeners !== null) byKey.set(key, { ...existing, listeners: s.listeners });
  }
  return [...byKey.values()].slice(0, limit);
}
