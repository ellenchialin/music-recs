import { describe, expect, it } from "vitest";
import { CACHE_MAX_AGE_DAYS, isFresh } from "./is-fresh";

// 「現在」由參數傳入，測試不必等 30 天，也不必 mock 系統時間
const now = new Date("2026-11-03T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("isFresh", () => {
  it("keeps external data for 30 days", () => {
    expect(CACHE_MAX_AGE_DAYS).toBe(30);
  });

  it("is fresh just before the limit and stale just after", () => {
    expect(isFresh(daysAgo(29.9), now)).toBe(true);
    expect(isFresh(daysAgo(30.1), now)).toBe(false);
  });

  // 從來沒抓過（例如相似歌手還沒抓）用 null 表示，當然不新鮮
  it("treats never-fetched as stale", () => {
    expect(isFresh(null, now)).toBe(false);
  });

  // 伺服器時鐘被調過，fetched_at 可能比現在還晚；當作新鮮，不要每次都重抓
  it("treats a fetch time in the future as fresh", () => {
    expect(isFresh(daysAgo(-1), now)).toBe(true);
  });
});
