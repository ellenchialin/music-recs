import { getDb } from "../db/client";
import { getItunesClient, getLastfmClient, getReasonsWriter } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { getReasons } from "../services/reasons";
import { recommendationsQuery } from "../services/recommendations-query";

// GET /api/reasons?seed=…&exclude=… → { reasons: { [artist]: string | null } }, the same query as
// /api/recommendations. Asked after the records are on screen; any failure just means no reasons,
// so the page keeps "Similar to …"
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "reasons");
  const { seeds, exclude } = await getValidatedQuery(event, (query) => recommendationsQuery.parse(query));
  try {
    const reasons = await getReasons(
      { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date(), writer: getReasonsWriter() },
      { seeds, exclude },
    );
    return { reasons };
  } catch (err) {
    console.error("Reasons failed:", err instanceof Error ? err.message : err);
    return { reasons: {} };
  }
});
