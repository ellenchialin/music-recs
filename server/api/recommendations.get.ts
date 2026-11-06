import { getDb } from "../db/client";
import { LastfmError } from "../lastfm/client";
import { getItunesClient, getLastfmClient } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { SeedNotFoundError, getRecommendations } from "../services/recommendations";
import { recommendationsQuery } from "../services/recommendations-query";

// GET /api/recommendations?seed=Tame%20Impala&seed=Kokoroko (&exclude=… when exploring).
// Rate-limits, validates, calls the service and maps errors to status codes
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "recommendations");
  const { seeds, exclude } = await getValidatedQuery(event, (query) => recommendationsQuery.parse(query));

  try {
    return await getRecommendations(
      { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date() },
      { seeds, exclude },
    );
  } catch (err) {
    // 404 with similar names the page can suggest
    if (err instanceof SeedNotFoundError) {
      throw createError({
        statusCode: 404,
        statusMessage: "Artist not found",
        data: { seed: err.seed, suggestions: err.suggestions },
      });
    }
    // Don't pass Last.fm's own message on to the client
    if (err instanceof LastfmError) {
      throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
    }
    throw err;
  }
});
