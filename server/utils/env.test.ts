import { describe, expect, it } from "vitest";
import { parseDbEnv, parseLastfmEnv } from "./env";

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
