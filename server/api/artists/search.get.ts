import { z } from "zod";
import { LastfmError } from "../../lastfm/client";
import { getLastfmClient } from "../../services/clients";
import { enforceRateLimit } from "../../services/rate-limit";
import { toArtistSuggestions } from "../../utils/artist-suggestions";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";

// GET /api/artists/search?q=tame → [{ name, listeners }] for the seed autocomplete
const query = z.object({ q: z.string().trim().min(1).max(100) });

// Cache only the Last.fm call, for a day, keyed by the normalized query. Caching the whole route
// would skip the rate limit on hits and replay the first caller's response headers to others
const searchArtists = defineCachedFunction(
  async (q: string) => toArtistSuggestions(await getLastfmClient().searchArtists(q, { limit: 15 })),
  { name: "artist-search", maxAge: 60 * 60 * 24, getKey: (q: string) => normalizeArtistName(q) },
);

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
