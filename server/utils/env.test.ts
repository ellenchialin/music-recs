import { describe, expect, it } from "vitest";
import { parseDbEnv } from "./env";

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
