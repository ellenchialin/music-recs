// Per-request timings sent back in a Server-Timing header, readable in the browser's network panel.
// Added to find where a cold instance's seconds go (see docs/ai-log.md, 2026-11-17)

export type RequestTiming = { queries: number; dbMs: number; firstQueryMs: number | null };

export function createRequestTiming(): RequestTiming {
  return { queries: 0, dbMs: 0, firstQueryMs: null };
}

// ms runs from asking the pool to the result, so it includes waiting for a free or new connection
export function recordQuery(timing: RequestTiming, ms: number) {
  timing.queries++;
  timing.dbMs += ms;
  timing.firstQueryMs ??= ms;
}

export function serverTimingHeader({
  totalMs,
  instanceAgeMs,
  timing,
}: {
  totalMs: number;
  instanceAgeMs: number;
  timing: RequestTiming;
}): string {
  const metrics = [`total;dur=${totalMs.toFixed(1)}`];
  if (timing.queries > 0) {
    metrics.push(`db;dur=${timing.dbMs.toFixed(1)};desc="${timing.queries} ${timing.queries === 1 ? "query" : "queries"}"`);
    metrics.push(`db-first;dur=${timing.firstQueryMs!.toFixed(1)}`);
  }
  // How long this server process has been running when the request arrived: a few seconds means
  // the request landed on a fresh instance
  metrics.push(`instance;desc="up ${(instanceAgeMs / 1000).toFixed(1)} s"`);
  return metrics.join(", ");
}
