// How long Last.fm and iTunes data stays cached in Postgres
export const CACHE_MAX_AGE_DAYS = 30;
const MAX_AGE_MS = CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

// null means never fetched. `now` is passed in so tests control the clock
export function isFresh(fetchedAt: Date | null, now: Date): boolean {
  if (fetchedAt === null) return false;
  return now.getTime() - fetchedAt.getTime() < MAX_AGE_MS;
}
