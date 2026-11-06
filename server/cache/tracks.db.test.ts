import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { tracks } from "../db/schema";
import { ItunesError, type ItunesClient } from "../itunes/client";
import creep from "../itunes/fixtures/search-radiohead-creep.json";
import { searchResponse, type ItunesTrack } from "../itunes/schemas";
import type { LastfmClient } from "../lastfm/client";
import toptracks from "../lastfm/fixtures/toptracks-radiohead.json";
import { topTracksResponse, type TopTrack } from "../lastfm/schemas";
import { getArtistTrack } from "./tracks";

const db = getDb();
const radioheadTop = topTracksResponse.parse(toptracks.body);
const creepResults = searchResponse.parse(creep.body);

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-03T12:00:00Z");
const later = (days: number) => new Date(now.getTime() + days * day);

// Fake clients that record calls. iTunes results are per store; missing stores return [].
// By default only the TW store has Creep
type Stores = Partial<Record<string, ItunesTrack[]>>;
function fakes({ top = radioheadTop, results = { TW: creepResults } }: { top?: TopTrack[]; results?: Stores } = {}) {
  const calls = { getTopTracks: 0, searchTracks: [] as string[] };
  const lastfm: Pick<LastfmClient, "getTopTracks"> = {
    getTopTracks: async () => {
      calls.getTopTracks++;
      return top;
    },
  };
  const itunes: Pick<ItunesClient, "searchTracks"> = {
    searchTracks: async (term, { country = "TW" } = {}) => {
      calls.searchTracks.push(`${country} ${term}`);
      return results[country] ?? [];
    },
  };
  return { lastfm, itunes, calls };
}

beforeEach(async () => {
  await db.execute(sql`truncate tracks restart identity`);
});

describe("getArtistTrack", () => {
  it("takes the artist's top track and finds its preview on iTunes", async () => {
    const { lastfm, itunes, calls } = fakes();

    const track = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    expect(calls.getTopTracks).toBe(1);
    expect(calls.searchTracks).toEqual(["TW Radiohead Creep"]);
    expect(track).toMatchObject({
      artistName: "Radiohead",
      title: "Creep",
      itunesId: 1679849823,
      previewUrl: expect.stringMatching(/^https:\/\/audio-ssl\.itunes\.apple\.com\//),
      artworkUrl: expect.stringMatching(/600x600bb\.jpg$/),
      fetchedAt: now,
    });
  });

  it("serves a cached track without calling either API", async () => {
    const { lastfm, itunes, calls } = fakes();
    await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    const track = await getArtistTrack({ db, lastfm, itunes, now: later(29) }, "radiohead ");

    expect(calls.getTopTracks).toBe(1);
    expect(calls.searchTracks).toHaveLength(1);
    expect(track?.title).toBe("Creep");
  });

  // Otherwise every recommendation of this artist would ask iTunes again and hit its rate limit
  it("remembers that iTunes had nothing, so it does not ask again", async () => {
    const { lastfm, itunes, calls } = fakes({ results: {} });

    const first = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");
    const second = await getArtistTrack({ db, lastfm, itunes, now: later(1) }, "Radiohead");

    expect(first).toMatchObject({ title: "Creep", itunesId: null, previewUrl: null, artworkUrl: null });
    expect(second?.id).toBe(first?.id);
    expect(calls.searchTracks).toHaveLength(3);
  });

  it("refetches after 30 days and updates the same row", async () => {
    const first = await getArtistTrack({ db, ...fakes({ results: {} }), now }, "Radiohead");
    const { lastfm, itunes, calls } = fakes();

    const track = await getArtistTrack({ db, lastfm, itunes, now: later(31) }, "Radiohead");

    expect(calls.searchTracks).toHaveLength(1);
    expect(track).toMatchObject({ id: first?.id, itunesId: 1679849823, fetchedAt: later(31) });
    expect(await db.select().from(tracks)).toHaveLength(1);
  });

  // Stores localize names (BoA is 「寶兒」 in the TW store)
  it("tries the TW, then US, then JP store until one has the track", async () => {
    const jpCreep = { ...creepResults[0]!, id: 42 };
    const { lastfm, itunes, calls } = fakes({ results: { TW: [], US: [], JP: [jpCreep] } });

    const track = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    expect(calls.searchTracks).toEqual(["TW Radiohead Creep", "US Radiohead Creep", "JP Radiohead Creep"]);
    expect(track?.itunesId).toBe(42);
  });

  it("stops at the first store that has the track", async () => {
    const usCreep = { ...creepResults[0]!, id: 7 };
    const { lastfm, itunes, calls } = fakes({ results: { TW: [], US: [usCreep], JP: creepResults } });

    const track = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    expect(calls.searchTracks).toEqual(["TW Radiohead Creep", "US Radiohead Creep"]);
    expect(track?.itunesId).toBe(7);
  });

  it("returns null when Last.fm has no top track", async () => {
    const { lastfm, itunes, calls } = fakes({ top: [] });

    expect(await getArtistTrack({ db, lastfm, itunes, now }, "Nobody")).toBeNull();
    expect(calls.searchTracks).toEqual([]);
  });

  // Cache "iTunes has nothing", never "iTunes is down", or the preview is gone for 30 days
  it("does not cache anything when iTunes fails", async () => {
    const { lastfm, itunes } = fakes();
    itunes.searchTracks = async () => {
      throw new ItunesError("search: HTTP 403, response is not JSON", 403);
    };

    await expect(getArtistTrack({ db, lastfm, itunes, now }, "Radiohead")).rejects.toBeInstanceOf(ItunesError);
    expect(await db.select().from(tracks)).toEqual([]);
  });

  it("does not cache anything when a later store fails", async () => {
    const { lastfm, itunes } = fakes({ results: {} });
    itunes.searchTracks = async (_term, { country = "TW" } = {}) => {
      if (country === "US") throw new ItunesError("search: HTTP 403, response is not JSON", 403);
      return [];
    };

    await expect(getArtistTrack({ db, lastfm, itunes, now }, "Radiohead")).rejects.toBeInstanceOf(ItunesError);
    expect(await db.select().from(tracks)).toEqual([]);
  });
});
