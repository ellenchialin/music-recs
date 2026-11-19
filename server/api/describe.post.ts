import { getDb } from "../db/client";
import { getLastfmClient, getTasteModel } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { runTasteAgent, type TasteAgentEvent } from "../services/taste-agent";
import { assertSameOrigin } from "../services/visitor";
import { describeRequest } from "../utils/taste-agent";

// POST /api/describe { description } → a Server-Sent Events stream of the taste agent's work:
// "step" { id, label, status, summary? } as each lookup starts and ends, then "suggestion"
// { artists: [{ name, why }] } and "done", or "stopped" { why: off | limit | failed | timeout | nothing }.
// POST because the description is free text, and only from our own pages, since each run costs
export default defineEventHandler(async (event) => {
  assertSameOrigin(event);
  await enforceRateLimit(event, "describe");
  const { description } = await readValidatedBody(event, (body) => describeRequest.parse(body));

  const stream = createEventStream(event);
  // The visitor closed the page or stopped the search: stop the model, nobody is reading
  const left = new AbortController();
  stream.onClosed(() => left.abort());

  let sending = Promise.resolve();
  const send = ({ type, ...data }: TasteAgentEvent) => {
    sending = sending.then(() => stream.push({ event: type, data: JSON.stringify(data) }));
  };

  void (async () => {
    try {
      await runTasteAgent({ db: getDb(), lastfm: getLastfmClient(), now: new Date(), model: getTasteModel() }, description, send, left.signal);
    } catch (err) {
      console.error("Describe failed:", err instanceof Error ? err.message : err);
      send({ type: "stopped", why: "failed" });
    } finally {
      await sending;
      await stream.close();
    }
  })();

  return stream.send();
});
