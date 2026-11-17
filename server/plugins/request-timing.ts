import { useEvent } from "nitropack/runtime";
import { onDbQuery } from "../db/client";
import { createRequestTiming, recordQuery, serverTimingHeader, type RequestTiming } from "../utils/request-timing";

declare module "h3" {
  interface H3EventContext {
    requestTiming?: { startedAt: number; timing: RequestTiming };
  }
}

// Every response gets a Server-Timing header: total time, time in the database, the first query
// (where a cold connection shows) and how long the instance has been up.
// performance.now() counts from the process's start, so it's also the instance's age
export default defineNitroPlugin((nitroApp) => {
  onDbQuery((ms) => {
    const current = currentRequestTiming();
    if (current) recordQuery(current.timing, ms);
  });

  nitroApp.hooks.hook("request", (event) => {
    event.context.requestTiming = { startedAt: performance.now(), timing: createRequestTiming() };
  });

  nitroApp.hooks.hook("beforeResponse", (event) => {
    const current = event.context.requestTiming;
    if (!current || event.node.res.headersSent) return;
    const now = performance.now();
    setResponseHeader(
      event,
      "Server-Timing",
      serverTimingHeader({ totalMs: now - current.startedAt, instanceAgeMs: current.startedAt, timing: current.timing }),
    );
  });
});

// Queries outside a request (the wake middleware's waitUntil after the response) have none
function currentRequestTiming() {
  try {
    return useEvent().context.requestTiming;
  } catch {
    return undefined;
  }
}
