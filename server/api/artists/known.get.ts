import { z } from "zod";
import { getDb } from "../../db/client";
import { searchKnownArtists } from "../../services/known-artists";
import { enforceRateLimit } from "../../services/rate-limit";

// GET /api/artists/known?q=radioh → [{ name, listeners }] from our own database, in milliseconds.
// The autocomplete shows these while /api/artists/search waits on Last.fm
const query = z.object({ q: z.string().trim().min(1).max(100) });

export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "knownSearch");
  const { q } = await getValidatedQuery(event, (input) => query.parse(input));
  return searchKnownArtists(getDb(), q);
});
