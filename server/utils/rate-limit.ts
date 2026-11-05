import { createHash } from "node:crypto";

// 速率限制的純函式：固定時間窗（fixed window）。
// 時間切成一格一格（例如每分鐘一格），每格各自計數，超過上限就擋到這格結束

export type RateLimitRule = {
  // 一格內最多幾次
  limit: number;
  // 一格多長（毫秒）
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  // 這格還能再打幾次（給 X-RateLimit-Remaining 用）
  remaining: number;
  // 到這格結束還有幾秒（給 Retry-After 用）
  retryAfter: number;
};

// 這個時間點屬於哪一格：往下取到 windowMs 的整數倍。
// 用 epoch 毫秒算，跟時區無關；一分鐘一格時就是「這一分鐘的 00 秒」
export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

// count：包含這一次的次數（資料庫 +1 之後回傳的值）。等於 limit 還可以，超過才擋
export function checkLimit(count: number, rule: RateLimitRule, now: Date): RateLimitResult {
  const resetAt = windowStart(now, rule.windowMs).getTime() + rule.windowMs;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    // 無條件進位：還剩 0.5 秒時說 1 秒，不會叫人「0 秒後再試」
    retryAfter: Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000)),
  };
}

// 不存原始 IP（不收集個資）：存「IP ＋ 鹽」的 SHA-256。
// 同一個 IP 每次得到同一個值，才數得出次數；鹽是伺服器的祕密，沒有鹽就不能把所有 IP 都算一遍來反查
export function hashClientIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
