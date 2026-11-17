import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { tagCharts } from "../db/schema";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import chart from "../lastfm/fixtures/topartists-psychedelic.json";
import { tagTopArtistsResponse } from "../lastfm/schemas";
import { getTagChart } from "./tag-charts";

const db = getDb();
const psychedelic = tagTopArtistsResponse.parse(chart.body);

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-17T12:00:00Z");
const later = (days: number) => new Date(now.getTime() + days * day);

function fakeLastfm(artists: { name: string; mbid: string | null }[] = psychedelic) {
  const calls: string[] = [];
  const lastfm: Pick<LastfmClient, "getTagTopArtists"> = {
    getTagTopArtists: async (tag) => {
      calls.push(tag);
      return artists;
    },
  };
  return { lastfm, calls };
}

beforeEach(async () => {
  await db.execute(sql`truncate tag_charts`);
});

describe("getTagChart", () => {
  it("fetches a genre's top artists once and stores their names in chart order", async () => {
    const { lastfm, calls } = fakeLastfm();

    const names = await getTagChart({ db, lastfm, now }, "psychedelic");

    expect(calls).toEqual(["psychedelic"]);
    expect(names).toEqual(psychedelic.map((a) => a.name));
    expect(await db.select().from(tagCharts)).toHaveLength(1);
  });

  it("serves a cached chart without calling Last.fm, for any spelling of the tag", async () => {
    const { lastfm, calls } = fakeLastfm();
    await getTagChart({ db, lastfm, now }, "psychedelic");

    const names = await getTagChart({ db, lastfm, now: later(29) }, "Psychedelic");

    expect(calls).toEqual(["psychedelic"]);
    expect(names).toEqual(psychedelic.map((a) => a.name));
  });

  it("refetches after 30 days and replaces the chart", async () => {
    await getTagChart({ db, lastfm: fakeLastfm().lastfm, now }, "psychedelic");
    const { lastfm, calls } = fakeLastfm([{ name: "Pond", mbid: null }]);

    const names = await getTagChart({ db, lastfm, now: later(31) }, "psychedelic");

    expect(calls).toHaveLength(1);
    expect(names).toEqual(["Pond"]);
    expect(await db.select().from(tagCharts)).toHaveLength(1);
  });

  // An empty chart can't fill a round, and caching it would fail every round in that genre for a month
  it("doesn't cache an empty chart, so the next round asks again", async () => {
    const { lastfm, calls } = fakeLastfm([]);

    expect(await getTagChart({ db, lastfm, now }, "psychedelic")).toEqual([]);
    await getTagChart({ db, lastfm, now }, "psychedelic");

    expect(calls).toHaveLength(2);
    expect(await db.select().from(tagCharts)).toEqual([]);
  });

  it("stores nothing when Last.fm fails, so the next round retries", async () => {
    const lastfm: Pick<LastfmClient, "getTagTopArtists"> = {
      getTagTopArtists: async () => {
        throw new LastfmError("tag.getTopArtists: Operation failed", 500, 8);
      },
    };

    await expect(getTagChart({ db, lastfm, now }, "psychedelic")).rejects.toBeInstanceOf(LastfmError);
    expect(await db.select().from(tagCharts)).toEqual([]);
  });
});
