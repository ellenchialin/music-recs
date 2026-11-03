// 外部資料（Last.fm、iTunes）在 Postgres 快取多久
export const CACHE_MAX_AGE_DAYS = 30;
const MAX_AGE_MS = CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// fetchedAt 是 null 代表從來沒抓過。now 由呼叫的人傳入，測試才能控制時間
export function isFresh(fetchedAt: Date | null, now: Date): boolean {
  if (fetchedAt === null) return false;
  return now.getTime() - fetchedAt.getTime() < MAX_AGE_MS;
}
