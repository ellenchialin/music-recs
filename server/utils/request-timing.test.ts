import { describe, expect, it } from "vitest";
import { createRequestTiming, recordQuery, serverTimingHeader } from "./request-timing";

describe("serverTimingHeader", () => {
  it("reports the whole request, its queries and the instance's age", () => {
    const timing = createRequestTiming();
    recordQuery(timing, 601.54);
    recordQuery(timing, 20.06);
    recordQuery(timing, 18.6);

    expect(serverTimingHeader({ totalMs: 812.44, instanceAgeMs: 1432, timing })).toBe(
      'total;dur=812.4, db;dur=640.2;desc="3 queries", db-first;dur=601.5, instance;desc="up 1.4 s"',
    );
  });

  it("leaves out the database when the request made no queries", () => {
    expect(serverTimingHeader({ totalMs: 3.21, instanceAgeMs: 95_000, timing: createRequestTiming() })).toBe(
      'total;dur=3.2, instance;desc="up 95.0 s"',
    );
  });

  it("says 1 query, not 1 queries", () => {
    const timing = createRequestTiming();
    recordQuery(timing, 2);

    expect(serverTimingHeader({ totalMs: 5, instanceAgeMs: 1000, timing })).toContain('db;dur=2.0;desc="1 query"');
  });
});
