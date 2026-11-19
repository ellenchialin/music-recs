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
  return sendEvents<TasteAgentEvent>(
    event,
    (send, signal) =>
      runTasteAgent({ db: getDb(), lastfm: getLastfmClient(), now: new Date(), model: getTasteModel() }, description, send, signal),
    { label: "Describe", onError: (send) => send({ type: "stopped", why: "failed" }) },
  );
});
