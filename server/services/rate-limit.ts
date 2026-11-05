import { lt, sql } from "drizzle-orm";
import type { H3Event } from "h3";
import { getDb, type Db } from "../db/client";
import { rateLimits } from "../db/schema";
import { parseRateLimitEnv } from "../utils/env";
import { checkLimit, hashClientIp, windowStart, type RateLimitResult, type RateLimitRule } from "../utils/rate-limit";

// 清理：每次寫入有 1% 的機會順便刪掉一小時以前的列。
// 不必另外排程（Vercel Cron），表的大小大約是「最近一小時有幾個 IP × 每分鐘一列」
const CLEANUP_PROBABILITY = 0.01;
const KEEP_MS = 60 * 60 * 1000;

type Deps = {
  db: Db;
  now: Date;
  // 注入亂數：測試才能決定這次要不要清理
  random?: () => number;
};

// 記一次請求，回傳這次能不能過。key 例如 "search:<IP 的雜湊>"
export async function hitRateLimit({ db, now, random = Math.random }: Deps, key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  // upsert：這格還沒有就新增 count = 1；已經有就 count + 1。
  // 「+1」寫在 SQL 裡由資料庫一次做完，同時來的請求會排隊各加一次，不會兩個都讀到 5、都寫回 6
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

// 各 API 的上限（每個 IP 每分鐘）。只限制會打外部 API 的路由；數字先估，試玩後再調
export const RATE_LIMITS = {
  // 一次推薦最多打幾十次 Last.fm／iTunes（有快取就少很多）
  recommendations: { limit: 20, windowMs: 60_000 },
  // 自動完成：輸入框有 debounce，但打字快時一分鐘還是會送出十幾次
  search: { limit: 60, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;

// route 用：記一次這個 IP 的請求，超過就丟 429，並用 Retry-After 告訴對方幾秒後再試。
// IP 取 x-forwarded-for 的第一個：部署在 Vercel 時，請求先經過 Vercel 的 proxy，真正的 IP 在這個 header
export async function enforceRateLimit(event: H3Event, name: keyof typeof RATE_LIMITS) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? "unknown";
  const key = `${name}:${hashClientIp(ip, parseRateLimitEnv().RATE_LIMIT_SALT)}`;
  const result = await hitRateLimit({ db: getDb(), now: new Date() }, key, RATE_LIMITS[name]);
  if (!result.allowed) {
    setResponseHeader(event, "Retry-After", result.retryAfter);
    throw createError({ statusCode: 429, statusMessage: "Too many requests, try again in a minute" });
  }
}
