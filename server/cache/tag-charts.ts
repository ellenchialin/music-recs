import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tagCharts } from "../db/schema";
import type { LastfmClient } from "../lastfm/client";
import { tagKey } from "../utils/tag-key";
import { isFresh } from "../utils/is-fresh";

// Cache-aside for a genre's top artists, like getArtist: every Taste Check round needs one, and
// a chart barely moves in a month

type Deps = { db: Db; lastfm: Pick<LastfmClient, "getTagTopArtists">; now: Date };

export async function getTagChart({ db, lastfm, now }: Deps, tag: string): Promise<string[]> {
  const key = tagKey(tag);
  const [cached] = await db.select().from(tagCharts).where(eq(tagCharts.tagKey, key));
  if (cached && isFresh(cached.fetchedAt, now)) return cached.artists;

  const names = (await lastfm.getTagTopArtists(tag)).map((a) => a.name);
  // Not cached: it can't fill a round, and stored it would fail that genre's rounds for a month
  if (names.length === 0) return names;
  const values = { artists: names, fetchedAt: now };
  // Upsert so two rounds starting at once on a new genre don't hit the primary key
  await db.insert(tagCharts).values({ tagKey: key, ...values }).onConflictDoUpdate({ target: tagCharts.tagKey, set: values });
  return names;
}
