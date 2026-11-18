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

  const stream = createEventStream(event);
  // The visitor closed the page or moved on: stop the model call, nobody is reading
  const left = new AbortController();
  stream.onClosed(() => left.abort());

  // Pushes in order, one after another, so a reason never overtakes the end of the stream
  let sending = Promise.resolve();
  const send = ({ type, ...data }: ReasonsEvent) => {
    sending = sending.then(() => stream.push({ event: type, data: JSON.stringify(data) }));
  };

  void (async () => {
    try {
      await streamReasons(
        { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date(), writer: getReasonsWriter() },
        { seeds, exclude, popularity, first },
        send,
        left.signal,
      );
    } catch (err) {
      // Rebuilding the list failed (Last.fm down, say): the page keeps "Similar to …" and can retry
      console.error("Reasons failed:", err instanceof Error ? err.message : err);
      send({ type: "stopped", why: "failed" });
    } finally {
      await sending;
      await stream.close();
    }
  })();

  return stream.send();
});
