import { describe, expect, it } from "vitest";
import { parseDbEnv, parseLastfmEnv, parseRateLimitEnv } from "./env";

describe("parseDbEnv", () => {
  it("accepts a postgres URL", () => {
    const env = parseDbEnv({ DATABASE_URL: "postgres://app:app@localhost:5434/music" });
    expect(env.DATABASE_URL).toContain("localhost:5434");
  });

  it("rejects a missing or non-postgres URL", () => {
    expect(() => parseDbEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseDbEnv({ DATABASE_URL: "mysql://localhost/music" })).toThrow(/DATABASE_URL/);
  });

  it("does not echo the value in the error", () => {
    expect(() => parseDbEnv({ DATABASE_URL: "not-a-url-with-secret" })).toThrow(/^(?!.*secret).*DATABASE_URL/);
  });
});

describe("parseLastfmEnv", () => {
  it("accepts a 32-character hex API key", () => {
    const env = parseLastfmEnv({ LASTFM_API_KEY: "0123456789abcdef0123456789abcdef" });
    expect(env.LASTFM_API_KEY).toHaveLength(32);
  });

  it("rejects a missing or malformed key without echoing it", () => {
    expect(() => parseLastfmEnv({})).toThrow(/LASTFM_API_KEY/);
    expect(() => parseLastfmEnv({ LASTFM_API_KEY: "secret-but-wrong" })).toThrow(/^(?!.*secret).*LASTFM_API_KEY/);
  });
});

describe("parseRateLimitEnv", () => {
  it("accepts a salt of at least 32 characters", () => {
    const env = parseRateLimitEnv({ RATE_LIMIT_SALT: "a".repeat(32) });
    expect(env.RATE_LIMIT_SALT).toHaveLength(32);
  });

  // Vercel sets VERCEL=1, and its proxy overwrites x-forwarded-for
  it("trusts the proxy only on Vercel", () => {
    expect(parseRateLimitEnv({ RATE_LIMIT_SALT: "a".repeat(32), VERCEL: "1" }).trustProxy).toBe(true);
    expect(parseRateLimitEnv({ RATE_LIMIT_SALT: "a".repeat(32) }).trustProxy).toBe(false);
  });

  it("rejects a missing or short salt without echoing it", () => {
    expect(() => parseRateLimitEnv({})).toThrow(/RATE_LIMIT_SALT/);
    expect(() => parseRateLimitEnv({ RATE_LIMIT_SALT: "short-secret" })).toThrow(/^(?!.*secret).*RATE_LIMIT_SALT/);
  });
});
