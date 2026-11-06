import { describe, expect, it } from "vitest";
import { CACHE_MAX_AGE_DAYS, isFresh } from "./is-fresh";

const now = new Date("2026-11-03T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isFresh", () => {
  it("keeps external data for 30 days", () => {
    expect(CACHE_MAX_AGE_DAYS).toBe(30);
  });

  it("is fresh just before the limit and stale just after", () => {
    expect(isFresh(daysAgo(29.9), now)).toBe(true);
    expect(isFresh(daysAgo(30.1), now)).toBe(false);
  });

  it("treats never-fetched as stale", () => {
    expect(isFresh(null, now)).toBe(false);
  });

  // A clock change can put fetched_at in the future; don't refetch every time
  it("treats a fetch time in the future as fresh", () => {
    expect(isFresh(daysAgo(-1), now)).toBe(true);
  });
});
