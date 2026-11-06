import { createHash } from "node:crypto";

// Fixed-window rate limiting: each window (e.g. a minute) has its own count,
// and requests over the limit are blocked until the window ends

export type RateLimitRule = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  // Seconds until the window resets, for Retry-After
  retryAfter: number;
};

// Rounds down to a multiple of windowMs since the epoch, so it's timezone-independent
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

// `count` includes this request (the value after the database increment)
export function checkLimit(count: number, rule: RateLimitRule, now: Date): RateLimitResult {
  const resetAt = windowStart(now, rule.windowMs).getTime() + rule.windowMs;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    // Round up so we never say "retry in 0 seconds"
    retryAfter: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
  };
}

// Raw IPs are never stored. The salt is a server secret, so the hash can't be reversed
// by hashing every possible IP
export function hashClientIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
