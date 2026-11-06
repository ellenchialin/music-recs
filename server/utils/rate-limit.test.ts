import { describe, expect, it } from "vitest";
import { checkLimit, hashClientIp, windowStart } from "./rate-limit";

const MINUTE = 60_000;
const at = (iso: string) => new Date(`2026-11-05T${iso}Z`);

describe("windowStart", () => {
  it("rounds down to the start of the window", () => {
    expect(windowStart(at("12:03:45.678"), MINUTE)).toEqual(at("12:03:00.000"));
  });

  it("keeps a time that is already on the boundary", () => {
    expect(windowStart(at("12:03:00.000"), MINUTE)).toEqual(at("12:03:00.000"));
  });

  it("puts the last millisecond in the old window and the next one in a new window", () => {
    expect(windowStart(at("12:03:59.999"), MINUTE)).toEqual(at("12:03:00.000"));
    expect(windowStart(at("12:04:00.000"), MINUTE)).toEqual(at("12:04:00.000"));
  });
});

// count includes the current request
describe("checkLimit", () => {
  const rule = { limit: 3, windowMs: MINUTE };

  it("allows requests up to the limit and says how many are left", () => {
    expect(checkLimit(1, rule, at("12:03:10"))).toMatchObject({ allowed: true, remaining: 2 });
    expect(checkLimit(3, rule, at("12:03:10"))).toMatchObject({ allowed: true, remaining: 0 });
  });

  it("blocks the request after the limit", () => {
    expect(checkLimit(4, rule, at("12:03:10"))).toMatchObject({ allowed: false, remaining: 0 });
  });

  it("says how many seconds until the window resets", () => {
    expect(checkLimit(4, rule, at("12:03:10")).retryAfter).toBe(50);
    expect(checkLimit(4, rule, at("12:03:59.500")).retryAfter).toBe(1);
    expect(checkLimit(4, rule, at("12:03:00")).retryAfter).toBe(60);
  });
});

describe("hashClientIp", () => {
  const salt = "test-salt-0123456789";

  it("gives the same hash for the same IP", () => {
    expect(hashClientIp("203.0.113.7", salt)).toBe(hashClientIp("203.0.113.7", salt));
  });

  it("gives different hashes for different IPs or salts", () => {
    expect(hashClientIp("203.0.113.7", salt)).not.toBe(hashClientIp("203.0.113.8", salt));
    expect(hashClientIp("203.0.113.7", salt)).not.toBe(hashClientIp("203.0.113.7", "another-salt-0123456"));
  });

  it("does not contain the IP", () => {
    const hash = hashClientIp("203.0.113.7", salt);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });
});
