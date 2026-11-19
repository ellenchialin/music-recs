import { getDb } from "../db/client";
import { getItunesClient, getLastfmClient } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { streamPreviews, type PreviewEvent } from "../services/recommendations";
import { previewsQuery } from "../services/recommendations-query";

// GET /api/previews?artist=Pond&artist=GUM → a Server-Sent Events stream: "preview" { artist,
// track, preview } for each artist as its lookup finishes, then "done". The recommendations list
// answers before uncached previews are looked up; the page asks here once for all of them.
// If it fails partway it just ends without "done", and the page offers Retry for the rest
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "previews");
  const { artists } = await getValidatedQuery(event, (query) => previewsQuery.parse(query));
  return sendEvents<PreviewEvent>(
    event,
    (send, signal) =>
      streamPreviews({ db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date() }, artists, send, signal),
    { label: "Previews" },
  );
});
