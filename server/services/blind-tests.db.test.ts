import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { blindTestItems, blindTests } from "../db/schema";
import type { ItunesClient } from "../itunes/client";
import type { LastfmClient } from "../lastfm/client";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import {
  BlindTestNotFoundError,
  BlindTestRatedError,
  NotEnoughSongsError,
  createBlindTest,
  getBlindTestStats,
  rateBlindTest,
} from "./blind-tests";

const db = getDb();
const now = new Date("2026-11-09T12:00:00Z");

// Two psychedelic seeds with three similar artists, and a "psychedelic" tag chart that also lists
// the seeds and a recommended artist, which must not end up in the control group
const artists: Record<string, { tags: string[]; similar?: [string, number][] }> = {
  "Tame Impala": { tags: ["psychedelic", "indie"], similar: [["Pond", 0.9], ["GUM", 0.8], ["Temples", 0.7]] },
  "Kokoroko": { tags: ["psychedelic", "afrobeat"], similar: [["Pond", 0.6], ["Ezra Collective", 0.5]] },
};
const tagChart = ["Tame Impala", "Pond", "Oasis", "Blur", "Pulp", "Suede"];

function fakeClients({ noPreview = [] as string[] } = {}) {
  const find = (name: string) => Object.entries(artists).find(([n]) => normalizeArtistName(n) === normalizeArtistName(name));
  const lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists" | "getTagTopArtists"> = {
    getInfo: async (name) => {
      const found = find(name);
      if (!found) throw new Error(`unexpected getInfo(${name})`);
      return { name: found[0], mbid: null, listeners: 1000, tags: found[1].tags };
    },
    getSimilar: async (name) => (find(name)?.[1].similar ?? []).map(([n, match]) => ({ name: n, mbid: null, match })),
    getTopTracks: async (name) => [{ name: `${name} Hit`, mbid: null, playcount: 1, listeners: 1 }],
    searchArtists: async () => [],
    getTagTopArtists: async () => tagChart.map((name) => ({ name, mbid: null })),
  };
  // Search terms are "<artist> <top track>", and the top track is "<artist> Hit"
  const itunes: Pick<ItunesClient, "searchTracks"> = {
    searchTracks: async (term) => {
      const artist = term.slice(0, (term.length - " Hit".length - 1) / 2);
      if (noPreview.includes(artist)) return [];
      const previewUrl = `https://audio.example/${encodeURIComponent(artist)}.m4a`;
      return [{ id: 1, name: `${artist} Hit`, artist, album: null, previewUrl, artworkUrl: null }];
    },
  };
  return { lastfm, itunes };
}

const deps = (options?: Parameters<typeof fakeClients>[0]) => ({ db, now, random: () => 0.3, ...fakeClients(options) });
const seeds = ["Tame Impala", "Kokoroko"];

beforeEach(async () => {
  await db.execute(sql`truncate artists, tracks, visitors, rate_limits restart identity cascade`);
});

describe("createBlindTest", () => {
  it("stores a round of three songs and returns only what's needed to play them", async () => {
    const visitorId = randomUUID();
    const round = await createBlindTest(deps(), { visitorId, seeds });

    expect(round.songs).toHaveLength(3);
    expect(round.songs.map((s) => s.position)).toEqual([0, 1, 2]);
    for (const song of round.songs) expect(Object.keys(song).sort()).toEqual(["position", "previewUrl"]);

    const [test] = await db.select().from(blindTests).where(eq(blindTests.id, round.id));
    expect(test).toMatchObject({ visitorId, seeds, algoVersion: "v2", controlTag: "psychedelic", ratedAt: null });
  });

  it("mixes one or two recommended songs with control songs from the seeds' shared genre", async () => {
    const round = await createBlindTest(deps(), { visitorId: randomUUID(), seeds });
    const items = await db.select().from(blindTestItems).where(eq(blindTestItems.testId, round.id));

    const recommended = items.filter((i) => i.isRecommended).map((i) => i.artist);
    const control = items.filter((i) => !i.isRecommended).map((i) => i.artist);
    expect(recommended.length).toBeGreaterThanOrEqual(1);
    expect(recommended.length).toBeLessThanOrEqual(2);
    for (const artist of recommended) expect(["Pond", "GUM", "Temples", "Ezra Collective"]).toContain(artist);
    // Seeds and recommended artists are on the tag chart too, but never in the control group
    for (const artist of control) expect(["Oasis", "Blur", "Pulp", "Suede"]).toContain(artist);
  });

  it("fails clearly when there aren't enough songs with previews", async () => {
    const noPreview = ["Pond", "GUM", "Temples", "Ezra Collective"];
    await expect(createBlindTest(deps({ noPreview }), { visitorId: randomUUID(), seeds })).rejects.toBeInstanceOf(NotEnoughSongsError);
  });
});

describe("rateBlindTest", () => {
  it("stores the ratings and reveals which songs were recommended", async () => {
    const visitorId = randomUUID();
    const round = await createBlindTest(deps(), { visitorId, seeds });

    const reveal = await rateBlindTest({ db, now }, { visitorId, testId: round.id, ratings: [5, 3, 1] });

    expect(reveal.map((r) => r.rating)).toEqual([5, 3, 1]);
    expect(reveal.every((r) => typeof r.isRecommended === "boolean" && r.artist && r.title)).toBe(true);
    const [test] = await db.select().from(blindTests).where(eq(blindTests.id, round.id));
    expect(test!.ratedAt).toEqual(now);
  });

  // Rating twice would let one round count double
  it("refuses a second rating of the same round", async () => {
    const visitorId = randomUUID();
    const round = await createBlindTest(deps(), { visitorId, seeds });
    await rateBlindTest({ db, now }, { visitorId, testId: round.id, ratings: [5, 3, 1] });
    await expect(rateBlindTest({ db, now }, { visitorId, testId: round.id, ratings: [1, 1, 1] })).rejects.toBeInstanceOf(
      BlindTestRatedError,
    );
  });

  // A round belongs to the visitor who started it; others get "not found", not "forbidden"
  it("refuses another visitor's round", async () => {
    const round = await createBlindTest(deps(), { visitorId: randomUUID(), seeds });
    await expect(
      rateBlindTest({ db, now }, { visitorId: randomUUID(), testId: round.id, ratings: [5, 3, 1] }),
    ).rejects.toBeInstanceOf(BlindTestNotFoundError);
  });
});

describe("getBlindTestStats", () => {
  it("counts only rated rounds", async () => {
    const visitorId = randomUUID();
    const rated = await createBlindTest(deps(), { visitorId, seeds });
    await createBlindTest(deps(), { visitorId, seeds });
    const reveal = await rateBlindTest({ db, now }, { visitorId, testId: rated.id, ratings: [5, 4, 2] });

    const [stats] = await getBlindTestStats(db);
    expect(stats).toMatchObject({ algoVersion: "v2", visitors: 1, ratings: 3 });
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rec = reveal.filter((r) => r.isRecommended).map((r) => r.rating!);
    const ctl = reveal.filter((r) => !r.isRecommended).map((r) => r.rating!);
    expect(stats!.difference).toBeCloseTo(mean(rec) - mean(ctl), 6);
  });
});
