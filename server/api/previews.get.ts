import { getDb } from "../db/client";
import { getItunesClient, getLastfmClient } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { getPreview } from "../services/recommendations";
import { previewQuery } from "../services/recommendations-query";

// GET /api/previews?artist=Pond → { track, preview }. The recommendations list answers before
// previews are looked up; the page asks here for each card still "pending"
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "previews");
  const { artist } = await getValidatedQuery(event, (query) => previewQuery.parse(query));
  return getPreview({ db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date() }, artist);
});
