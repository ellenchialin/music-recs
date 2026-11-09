import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client";
import { rateLimits } from "../db/schema";
import { ItunesError, type ItunesClient } from "../itunes/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { hitRateLimit } from "./rate-limit";

// Site-wide caps on calls to external APIs. Per-IP limits alone don't help: one uncached
// recommendation can make ~46 calls, and many IPs together could still get our key or server
// banned. Over budget, wrappers throw the client's own error so existing handling applies
// (a card's preview becomes "error" and isn't cached; a Last.fm failure becomes a 502)

const MINUTE = 60_000;
// iTunes allows about 20 a minute; Last.fm about 5 a second
const ITUNES_PER_MINUTE = 20;
const LASTFM_PER_MINUTE = 200;
// How long to leave iTunes alone after it throttles us
const BREAKER_MS = 5 * MINUTE;

type Deps = { db: Db; now: () => Date; limit?: number };

async function takeFromBudget({ db, now }: Deps, name: string, limit: number): Promise<boolean> {
  const result = await hitRateLimit({ db, now: now() }, `budget:${name}`, { limit, windowMs: MINUTE });
  return result.allowed;
}

// The breaker is a rate_limits row stamped with the time it tripped; old rows are cleaned up there
async function breakerOpen({ db, now }: Deps, name: string): Promise<boolean> {
  const since = new Date(now().getTime() - BREAKER_MS);
  const [row] = await db
    .select({ key: rateLimits.key })
    .from(rateLimits)
    .where(and(eq(rateLimits.key, `breaker:${name}`), gt(rateLimits.windowStart, since)))
    .limit(1);
  return Boolean(row);
}

async function tripBreaker({ db, now }: Deps, name: string) {
  await db.insert(rateLimits).values({ key: `breaker:${name}`, windowStart: now(), count: 1 }).onConflictDoNothing();
}

export function withItunesBudget<T extends Pick<ItunesClient, "searchTracks">>(client: T, deps: Deps): T {
  const limit = deps.limit ?? ITUNES_PER_MINUTE;
  return {
    ...client,
    searchTracks: async (...args: Parameters<ItunesClient["searchTracks"]>) => {
      if ((await breakerOpen(deps, "itunes")) || !(await takeFromBudget(deps, "itunes", limit))) {
        throw new ItunesError("search: skipped, over the site-wide budget", 429);
      }
      try {
        return await client.searchTracks(...args);
      } catch (err) {
        if (err instanceof ItunesError && (err.status === 403 || err.status === 429)) await tripBreaker(deps, "itunes");
        throw err;
      }
    },
  };
}

export function withLastfmBudget<T extends Partial<LastfmClient>>(client: T, deps: Deps): T {
  const limit = deps.limit ?? LASTFM_PER_MINUTE;
  const wrapped = Object.entries(client).map(([name, fn]) => [
    name,
    async (...args: unknown[]) => {
      if (!(await takeFromBudget(deps, "lastfm", limit))) {
        // 29 is Last.fm's own "rate limit exceeded" code
        throw new LastfmError(`${name}: skipped, over the site-wide budget`, 429, 29);
      }
      return (fn as (...a: unknown[]) => Promise<unknown>)(...args);
    },
  ]);
  return Object.fromEntries(wrapped) as T;
}
