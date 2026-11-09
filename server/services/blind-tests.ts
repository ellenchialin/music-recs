import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db/client";
import { blindTestItems, blindTests, visitors } from "../db/schema";
import type { ItunesClient } from "../itunes/client";
import type { LastfmClient } from "../lastfm/client";
import { getArtist } from "../cache/lastfm";
import { getArtistTrack } from "../cache/tracks";
import { computeStats, pickRound, pickTopTag, type Song, type VersionStats } from "../utils/blind-test";
import { mapLimit } from "../utils/map-limit";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { getRecommendations } from "./recommendations";

// A blind-test round: recommended songs mixed with same-genre control songs, played without names.
// Which songs were recommended stays on the server until the round is rated

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists" | "getTagTopArtists">;
  itunes: Pick<ItunesClient, "searchTracks">;
  now: Date;
  random?: () => number;
};

export class NotEnoughSongsError extends Error {
  constructor() {
    super("Not enough songs with previews for a blind test");
    this.name = "NotEnoughSongsError";
  }
}
export class BlindTestNotFoundError extends Error {
  constructor() {
    super("Blind test not found");
    this.name = "BlindTestNotFoundError";
  }
}
export class BlindTestRatedError extends Error {
  constructor() {
    super("Blind test already rated");
    this.name = "BlindTestRatedError";
  }
}

// Control candidates to look up; each may cost an iTunes search, so keep it small
const CONTROL_CANDIDATES = 6;
const CONCURRENCY = 3;

export async function createBlindTest(
  deps: Deps,
  { visitorId, seeds }: { visitorId: string; seeds: string[] },
): Promise<{ id: string; songs: { position: number; previewUrl: string }[] }> {
  const random = deps.random ?? Math.random;
  const result = await getRecommendations(deps, { seeds });

  const recommended: Song[] = result.recommendations.flatMap((r) =>
    r.preview.status === "available" && r.track ? [{ artist: r.artist, title: r.track.title, previewUrl: r.preview.url }] : [],
  );

  // Seeds are cached by getRecommendations, so this doesn't call Last.fm again
  const seedArtists = await Promise.all(result.seeds.map((name) => getArtist(deps, name)));
  const controlTag = pickTopTag(seedArtists.map((a) => a.tags));
  if (!controlTag) throw new NotEnoughSongsError();

  const taken = new Set([...result.seeds, ...result.recommendations.map((r) => r.artist)].map(normalizeArtistName));
  const chart = (await deps.lastfm.getTagTopArtists(controlTag)).filter((a) => !taken.has(normalizeArtistName(a.name)));
  const candidates: string[] = [];
  while (candidates.length < CONTROL_CANDIDATES && chart.length) {
    candidates.push(chart.splice(Math.floor(random() * chart.length), 1)[0]!.name);
  }
  const control = (
    await mapLimit(candidates, CONCURRENCY, async (artist): Promise<Song | null> => {
      const track = await getArtistTrack(deps, artist).catch(() => null);
      return track?.previewUrl ? { artist: track.artistName, title: track.title, previewUrl: track.previewUrl } : null;
    })
  ).filter((s): s is Song => s !== null);

  const round = pickRound({ recommended, control, random });
  if (!round) throw new NotEnoughSongsError();

  const id = await deps.db.transaction(async (tx) => {
    await tx.insert(visitors).values({ id: visitorId }).onConflictDoNothing();
    const [test] = await tx
      .insert(blindTests)
      .values({ visitorId, seeds: result.seeds, algoVersion: result.algoVersion, controlTag, createdAt: deps.now })
      .returning({ id: blindTests.id });
    await tx.insert(blindTestItems).values(round.map((song, position) => ({ testId: test!.id, position, ...song })));
    return test!.id;
  });

  return { id, songs: round.map((song, position) => ({ position, previewUrl: song.previewUrl })) };
}

export async function rateBlindTest(
  { db, now }: { db: Db; now: Date },
  { visitorId, testId, ratings }: { visitorId: string; testId: string; ratings: number[] },
) {
  return db.transaction(async (tx) => {
    // Claim the round in one conditional update, so two concurrent submissions can't both count
    const [claimed] = await tx
      .update(blindTests)
      .set({ ratedAt: now })
      .where(and(eq(blindTests.id, testId), eq(blindTests.visitorId, visitorId), isNull(blindTests.ratedAt)))
      .returning({ id: blindTests.id });
    if (!claimed) {
      const [exists] = await tx
        .select({ id: blindTests.id })
        .from(blindTests)
        .where(and(eq(blindTests.id, testId), eq(blindTests.visitorId, visitorId)));
      throw exists ? new BlindTestRatedError() : new BlindTestNotFoundError();
    }

    for (const [position, rating] of ratings.entries()) {
      await tx
        .update(blindTestItems)
        .set({ rating })
        .where(and(eq(blindTestItems.testId, testId), eq(blindTestItems.position, position)));
    }

    return tx
      .select({
        position: blindTestItems.position,
        artist: blindTestItems.artist,
        title: blindTestItems.title,
        isRecommended: blindTestItems.isRecommended,
        rating: blindTestItems.rating,
      })
      .from(blindTestItems)
      .where(eq(blindTestItems.testId, testId))
      .orderBy(asc(blindTestItems.position));
  });
}

export async function getBlindTestStats(db: Db): Promise<VersionStats[]> {
  const rows = await db
    .select({
      visitorId: blindTests.visitorId,
      algoVersion: blindTests.algoVersion,
      isRecommended: blindTestItems.isRecommended,
      rating: blindTestItems.rating,
    })
    .from(blindTestItems)
    .innerJoin(blindTests, eq(blindTestItems.testId, blindTests.id))
    .where(and(isNotNull(blindTests.ratedAt), isNotNull(blindTestItems.rating)));
  return computeStats(rows.map((r) => ({ ...r, rating: r.rating! })));
}
