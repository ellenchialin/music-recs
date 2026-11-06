import { asc, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { artistSimilar, artists } from "../db/schema";
import type { LastfmClient } from "../lastfm/client";
import { isFresh } from "../utils/is-fresh";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";

// Cache-aside for Last.fm data: read Postgres, call the API only when missing or stale, write back.
// Dependencies are passed in so tests can use a fake client and a fixed clock

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar">;
  now: Date;
};

export type Artist = typeof artists.$inferSelect;
export type CachedSimilarArtist = Omit<typeof artistSimilar.$inferSelect, "artistId">;

// Enough candidates to still have 10 after excluding seeds and explored artists
const SIMILAR_LIMIT = 50;

export async function getArtist({ db, lastfm, now }: Deps, name: string): Promise<Artist> {
  const [cached] = await db
    .select()
    .from(artists)
    .where(eq(artists.nameNorm, normalizeArtistName(name)));
  if (cached && isFresh(cached.fetchedAt, now)) return cached;

  const info = await lastfm.getInfo(name);
  const values = {
    name: info.name,
    mbid: info.mbid,
    listeners: info.listeners,
    tags: info.tags,
    fetchedAt: now,
  };

  // Upsert so two concurrent lookups of a new artist don't hit the unique constraint.
  // Keyed by Last.fm's autocorrected name, not the user's input
  const [row] = await db
    .insert(artists)
    .values({ ...values, nameNorm: normalizeArtistName(info.name) })
    .onConflictDoUpdate({ target: artists.nameNorm, set: values })
    .returning();
  return row!;
}

export async function getSimilarArtists({ db, lastfm, now }: Deps, artist: Artist): Promise<CachedSimilarArtist[]> {
  if (!isFresh(artist.similarFetchedAt, now)) {
    const similar = await lastfm.getSimilar(artist.name, { limit: SIMILAR_LIMIT });
    const rows = similar
      .map((a) => ({ artistId: artist.id, name: a.name, nameNorm: normalizeArtistName(a.name), mbid: a.mbid, match: a.match }))
      // Sorted so that when names collide after normalizing, the higher match wins
      .sort((a, b) => b.match - a.match);

    // One transaction, so we never end up with a fresh timestamp and an empty list
    await db.transaction(async (tx) => {
      await tx.delete(artistSimilar).where(eq(artistSimilar.artistId, artist.id));
      if (rows.length > 0) await tx.insert(artistSimilar).values(rows).onConflictDoNothing();
      await tx.update(artists).set({ similarFetchedAt: now }).where(eq(artists.id, artist.id));
    });
  }

  return db
    .select({ name: artistSimilar.name, nameNorm: artistSimilar.nameNorm, mbid: artistSimilar.mbid, match: artistSimilar.match })
    .from(artistSimilar)
    .where(eq(artistSimilar.artistId, artist.id))
    .orderBy(desc(artistSimilar.match), asc(artistSimilar.nameNorm));
}
