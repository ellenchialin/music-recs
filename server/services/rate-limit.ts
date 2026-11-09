import { lt, sql } from "drizzle-orm";
import type { H3Event } from "h3";
import { getDb, type Db } from "../db/client";
import { rateLimits } from "../db/schema";
import { parseRateLimitEnv } from "../utils/env";
import {
  checkLimit,
  clientBucket,
  hashClientIp,
  pickClientIp,
  windowStart,
  type RateLimitResult,
  type RateLimitRule,
} from "../utils/rate-limit";

// Each write has a 1% chance to delete windows older than an hour, so no cron job is needed
const CLEANUP_PROBABILITY = 0.01;
const KEEP_MS = 60 * 60 * 1000;

type Deps = {
  db: Db;
  now: Date;
  random?: () => number;
};

// Records a request and says whether it's allowed. key: e.g. "search:<ip hash>"
export async function hitRateLimit({ db, now, random = Math.random }: Deps, key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  // The increment runs in SQL, so concurrent requests can't both read 5 and write 6
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: windowStart(now, rule.windowMs), count: 1 })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` },
    })
    .returning({ count: rateLimits.count });

  if (random() < CLEANUP_PROBABILITY) {
    await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(now.getTime() - KEEP_MS)));
  }

  return checkLimit(row!.count, rule, now);
}

// Per IP per minute, only for routes that call external APIs. Tune after play-testing
export const RATE_LIMITS = {
  // Low because an uncached request can make dozens of external calls (see external-budget.ts)
  recommendations: { limit: 10, windowMs: 60_000 },
  // Debounced, but fast typing still sends a dozen or so a minute
  search: { limit: 60, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

// Throws 429 with Retry-After when over the limit. Outside Vercel, SSR's internal requests have no
// socket address and share the "unknown" bucket; that only matters in local dev
export async function enforceRateLimit(event: H3Event, name: keyof typeof RATE_LIMITS) {
  const { RATE_LIMIT_SALT, trustProxy } = parseRateLimitEnv();
  const ip = pickClientIp({
    forwardedFor: getRequestHeader(event, "x-forwarded-for"),
    socketAddress: event.node.req.socket?.remoteAddress,
    trustProxy,
  });
  const key = `${name}:${hashClientIp(clientBucket(ip), RATE_LIMIT_SALT)}`;
  const result = await hitRateLimit({ db: getDb(), now: new Date() }, key, RATE_LIMITS[name]);
  if (!result.allowed) {
    setResponseHeader(event, "Retry-After", result.retryAfter);
    throw createError({ statusCode: 429, statusMessage: "Too many requests, try again in a minute" });
  }
}
