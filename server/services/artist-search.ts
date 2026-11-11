import type { ArtistSearchResult } from "../lastfm/schemas";
import { toArtistSuggestions, type ArtistSuggestion } from "../utils/artist-suggestions";
import { mergeSuggestions, startsAWord, withoutLastWord } from "../../shared/utils/suggestion-match";

// Last.fm's artist search matches whole words, so "hiatus kai" finds nothing while the visitor is
// still typing. With more than one word, also search without the last one ("hiatus") at the same
// time and keep the names that start with what's typed. Those come first; Last.fm's own, looser
// matches follow (they catch typos like "Tame Impalla")
const LIMIT = 8;

// search: Last.fm's artist.search; the route passes a cached one, so "hiatus kai", "hiatus kaiy"
// and so on reuse one search for "hiatus" instead of spending Last.fm's budget on each keystroke
type Search = (q: string, limit: number) => Promise<ArtistSearchResult[]>;

export async function searchArtistSuggestions(search: Search, typed: string): Promise<ArtistSuggestion[]> {
  const wider = withoutLastWord(typed);
  const [exact, widerResults] = await Promise.all([
    search(typed, 15),
    // A bonus: if it fails, the main search still answers
    wider ? search(wider, 30).catch(() => []) : Promise.resolve([]),
  ]);
  const started = toArtistSuggestions(widerResults.filter((r) => startsAWord(r.name, typed)), LIMIT);
  return mergeSuggestions(started, toArtistSuggestions(exact, LIMIT), LIMIT);
}
