import { z } from "zod";
import { DEFAULT_POPULARITY, POPULARITY_SETTINGS } from "../../../shared/types/popularity";
import { getDb } from "../../db/client";
import { LastfmError } from "../../lastfm/client";
import { NotEnoughSongsError, createBlindTest } from "../../services/blind-tests";
import { getItunesClient, getLastfmClient } from "../../services/clients";
import { enforceRateLimit } from "../../services/rate-limit";
import { SeedNotFoundError } from "../../services/recommendations";
import { assertSameOrigin, getOrCreateVisitorId } from "../../services/visitor";

// POST /api/blind-tests { seeds, popularity? } → { id, songs: [{ position, previewUrl }] }
const body = z.object({
  seeds: z.array(z.string().trim().min(1).max(200)).min(1).max(3),
  // The slider setting of the list the visitor came from
  popularity: z.enum(POPULARITY_SETTINGS).default(DEFAULT_POPULARITY),
});

export default defineEventHandler(async (event) => {
  assertSameOrigin(event);
  await enforceRateLimit(event, "blindTest");
  const { seeds, popularity } = await readValidatedBody(event, (input) => body.parse(input));
  const visitorId = getOrCreateVisitorId(event);

  try {
    return await createBlindTest(
      { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date() },
      { visitorId, seeds, popularity },
    );
  } catch (err) {
    if (err instanceof NotEnoughSongsError) {
      throw createError({ statusCode: 422, statusMessage: "Not enough songs with previews for these artists" });
    }
    if (err instanceof SeedNotFoundError) throw createError({ statusCode: 404, statusMessage: "Artist not found" });
    if (err instanceof LastfmError) {
      throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
    }
    throw err;
  }
});
