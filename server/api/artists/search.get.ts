import { z } from "zod";
import { LastfmError } from "../../lastfm/client";
import { getLastfmClient } from "../../services/clients";
import { enforceRateLimit } from "../../services/rate-limit";
import { searchArtistSuggestions } from "../../services/artist-search";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";

// GET /api/artists/search?q=tame → [{ name, listeners }] for the seed autocomplete
const query = z.object({ q: z.string().trim().min(1).max(100) });

// Cache only the Last.fm calls, for a day, keyed by the normalized text. Caching the whole route
// would skip the rate limit on hits and replay the first caller's response headers to others.
// Per call, not per answer: one answer can use two searches, and the wider one ("hiatus") is the
// same for every keystroke of the last word
const lastfmSearch = defineCachedFunction(
  async (q: string, limit: number) => getLastfmClient().searchArtists(q, { limit }),
  { name: "lastfm-artist-search", maxAge: 60 * 60 * 24, getKey: (q: string, limit: number) => `${normalizeArtistName(q)}:${limit}` },
);
const searchArtists = (q: string) => searchArtistSuggestions(lastfmSearch, q);

export default defineEventHandler(async (event) => {
  // Cache hits count too: the limit is on calling this API
  await enforceRateLimit(event, "search");
  const { q } = await getValidatedQuery(event, (input) => query.parse(input));
  try {
    return await searchArtists(q);
  } catch (err) {
    if (err instanceof LastfmError) {
      throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
    }
    throw err;
  }
});
