import { eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { tracks } from "../db/schema";
import type { ItunesClient } from "../itunes/client";
import type { ItunesTrack } from "../itunes/schemas";
import type { LastfmClient } from "../lastfm/client";
import { isFresh } from "../utils/is-fresh";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { pickTrack } from "../utils/pick-track";

// Cache-aside for each artist's track: Last.fm top track → iTunes stores in order → pickTrack

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getTopTracks">;
  itunes: Pick<ItunesClient, "searchTracks">;
  now: Date;
};

export type ArtistTrack = typeof tracks.$inferSelect;

// Stores localize artist names (TW: BoA → 寶兒; JP: Radiohead → レディオヘッド), so no single
// store matches everyone. Try them in order
const ITUNES_STORES = ["TW", "US", "JP"];

// The fresh cached row, or null without calling any API
export async function getCachedArtistTrack({ db, now }: Pick<Deps, "db" | "now">, artistName: string): Promise<ArtistTrack | null> {
  const [cached] = await db.select().from(tracks).where(eq(tracks.artistNameNorm, normalizeArtistName(artistName)));
  return cached && isFresh(cached.fetchedAt, now) ? cached : null;
}

// artistName is Last.fm's spelling
export async function getArtistTrack({ db, lastfm, itunes, now }: Deps, artistName: string): Promise<ArtistTrack | null> {
  const artistNameNorm = normalizeArtistName(artistName);
  const cached = await getCachedArtistTrack({ db, now }, artistName);
  if (cached) return cached;

  const [top] = await lastfm.getTopTracks(artistName, { limit: 1 });
  // Rare; not cached, so the next request asks Last.fm again
  if (!top) return null;

  // Stop at the first match. Any store error throws and stores nothing; only when every store
  // answers with no match do we cache a row with a null preview
  let picked: ItunesTrack | null = null;
  for (const country of ITUNES_STORES) {
    const results = await itunes.searchTracks(`${artistName.trim()} ${top.name}`, { country });
    picked = pickTrack(results, { artist: artistName, title: top.name });
    if (picked) break;
  }

  const values = {
    artistName: artistName.trim(),
    title: top.name,
    itunesId: picked?.id ?? null,
    previewUrl: picked?.previewUrl ?? null,
    artworkUrl: picked?.artworkUrl ?? null,
    fetchedAt: now,
  };
  const [row] = await db
    .insert(tracks)
    .values({ ...values, artistNameNorm })
    .onConflictDoUpdate({ target: tracks.artistNameNorm, set: values })
    .returning();
  return row!;
}
