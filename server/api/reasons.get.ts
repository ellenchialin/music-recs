import { getDb } from "../db/client";
import { getItunesClient, getLastfmClient, getReasonsWriter } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { streamReasons, type ReasonsEvent } from "../services/reasons";
import { reasonsQuery } from "../services/recommendations-query";

// GET /api/reasons?seed=…&exclude=…&popularity=…&first=… → a Server-Sent Events stream, the same
// query as /api/recommendations. Events: "reason" { artist, reason } for each record, cached ones
// first; then "done" {}, or "stopped" { why: off | limit | failed | timeout }
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "reasons");
  const { seeds, exclude, popularity, first } = await getValidatedQuery(event, (query) => reasonsQuery.parse(query));
  return sendEvents<ReasonsEvent>(
    event,
    (send, signal) =>
      streamReasons(
        { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date(), writer: getReasonsWriter() },
        { seeds, exclude, popularity, first },
        send,
        signal,
      ),
    // Rebuilding the list failed (Last.fm down, say): the page keeps "Similar to …" and can retry
    { label: "Reasons", onError: (send) => send({ type: "stopped", why: "failed" }) },
  );
});
