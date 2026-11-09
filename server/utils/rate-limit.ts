import { createHash } from "node:crypto";
import { isIP } from "node:net";

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

// The rate-limit identity for a client: IPv4 as is, IPv6 by its /64 network.
// A single IPv6 user usually gets a whole /64 and can rotate through it for free
export function clientBucket(ip: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return mapped[1]!;
  if (isIP(ip) !== 6) return ip;
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::") ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right] : left;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

// Behind a proxy that overwrites x-forwarded-for (Vercel), its first entry is the client.
// Anywhere else the header is client-controlled, so use the connection's address
export function pickClientIp(opts: { forwardedFor?: string; socketAddress?: string; trustProxy: boolean }): string {
  const forwarded = opts.trustProxy ? opts.forwardedFor?.split(",")[0]?.trim() : undefined;
  return forwarded || opts.socketAddress || "unknown";
}

