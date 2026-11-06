import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { rateLimits } from "../db/schema";
import { hitRateLimit } from "./rate-limit";

const db = getDb();
const rule = { limit: 3, windowMs: 60_000 };
const at = (iso: string) => new Date(`2026-11-05T${iso}Z`);
// random() = 1 never triggers cleanup; the cleanup tests pass their own
const deps = (now: Date, random = () => 1) => ({ db, now, random });

beforeEach(async () => {
  await db.execute(sql`truncate rate_limits`);
});

describe("hitRateLimit", () => {
  it("counts each request in the same window", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await hitRateLimit(deps(at("12:03:10")), "search:abc", rule));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3]!.retryAfter).toBe(50);
  });

  it("starts over in the next window", async () => {
    for (let i = 0; i < 4; i++) await hitRateLimit(deps(at("12:03:10")), "search:abc", rule);
    const next = await hitRateLimit(deps(at("12:04:00")), "search:abc", rule);
    expect(next).toMatchObject({ allowed: true, remaining: 2 });
  });

  it("keeps separate counts per key", async () => {
    for (let i = 0; i < 4; i++) await hitRateLimit(deps(at("12:03:10")), "search:abc", rule);
    expect(await hitRateLimit(deps(at("12:03:10")), "search:def", rule)).toMatchObject({ allowed: true });
    expect(await hitRateLimit(deps(at("12:03:10")), "recommendations:abc", rule)).toMatchObject({ allowed: true });
  });

  // The increment happens in SQL, not read-modify-write, so concurrent requests aren't lost
  it("never lets more than the limit through when requests arrive at once", async () => {
    const many = { limit: 20, windowMs: 60_000 };
    const results = await Promise.all(
      Array.from({ length: 25 }, () => hitRateLimit(deps(at("12:03:10")), "search:abc", many)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    const [row] = await db.select().from(rateLimits);
    expect(row!.count).toBe(25);
  });

  it("sometimes deletes windows older than an hour", async () => {
    await hitRateLimit(deps(at("10:00:00")), "search:old", rule);
    await hitRateLimit(deps(at("11:30:00")), "search:recent", rule);
    await hitRateLimit(deps(at("12:03:10"), () => 0), "search:abc", rule);
    const keys = (await db.select().from(rateLimits)).map((r) => r.key).sort();
    expect(keys).toEqual(["search:abc", "search:recent"]);
  });

  it("leaves old windows alone most of the time", async () => {
    await hitRateLimit(deps(at("10:00:00")), "search:old", rule);
    await hitRateLimit(deps(at("12:03:10")), "search:abc", rule);
    expect(await db.select().from(rateLimits)).toHaveLength(2);
  });
});
