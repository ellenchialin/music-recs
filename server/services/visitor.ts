import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { H3Event } from "h3";
import { parseRateLimitEnv } from "../utils/env";
import { isAllowedOrigin } from "../utils/same-origin";

// The anonymous visitor ID: a random UUID in an httpOnly cookie, nothing else about the person
const COOKIE = "visitor_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function getVisitorId(event: H3Event): string | null {
  const value = getCookie(event, COOKIE);
  return z.uuid().safeParse(value).success ? value! : null;
}

export function getOrCreateVisitorId(event: H3Event): string {
  const existing = getVisitorId(event);
  if (existing) return existing;
  const id = randomUUID();
  // Lax: sent on same-site requests and top-level navigation, not on other sites' POSTs.
  // Secure outside dev, where localhost runs on plain http
  setCookie(event, COOKIE, id, { httpOnly: true, sameSite: "lax", secure: !import.meta.dev, path: "/", maxAge: ONE_YEAR });
  return id;
}

// CSRF check for routes that write: refuse POSTs whose Origin isn't this site
export function assertSameOrigin(event: H3Event) {
  const host = getRequestHost(event, { xForwardedHost: parseRateLimitEnv().trustProxy });
  if (!isAllowedOrigin(getRequestHeader(event, "origin"), host)) {
    throw createError({ statusCode: 403, statusMessage: "Cross-site request refused" });
  }
}
