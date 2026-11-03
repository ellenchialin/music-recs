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

// 兩個假的 client：回傳錄好的資料，記下呼叫次數和 iTunes 的「商店 搜尋字串」
// results 依商店給；沒給的商店回空陣列。預設只有台灣商店有 Creep 的結果
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
  // Last.fm 的熱門第一名是 Creep；拿「歌手 + 歌名」搜 iTunes，再用 pickTrack 挑出 Acoustic 版
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

  // iTunes 挑不到也要記住：不然每次推薦到這位歌手都會再問一次 iTunes，很快就撞到速率限制
  it("remembers that iTunes had nothing, so it does not ask again", async () => {
    const { lastfm, itunes, calls } = fakes({ results: {} });

    const first = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");
    const second = await getArtistTrack({ db, lastfm, itunes, now: later(1) }, "Radiohead");

    expect(first).toMatchObject({ title: "Creep", itunesId: null, previewUrl: null, artworkUrl: null });
    expect(second?.id).toBe(first?.id);
    // 三個商店各問一次，第二次一次都不問
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

  // 各國商店會把歌手名翻成當地寫法（台灣商店的 BoA 是「寶兒」），台灣挑不到就依序試美國、日本
  it("tries the TW, then US, then JP store until one has the track", async () => {
    const jpCreep = { ...creepResults[0]!, id: 42 };
    const { lastfm, itunes, calls } = fakes({ results: { TW: [], US: [], JP: [jpCreep] } });

    const track = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    expect(calls.searchTracks).toEqual(["TW Radiohead Creep", "US Radiohead Creep", "JP Radiohead Creep"]);
    expect(track?.itunesId).toBe(42);
  });

  // 挑到就停，不再問後面的商店：省下速率限制的額度
  it("stops at the first store that has the track", async () => {
    const usCreep = { ...creepResults[0]!, id: 7 };
    const { lastfm, itunes, calls } = fakes({ results: { TW: [], US: [usCreep], JP: creepResults } });

    const track = await getArtistTrack({ db, lastfm, itunes, now }, "Radiohead");

    expect(calls.searchTracks).toEqual(["TW Radiohead Creep", "US Radiohead Creep"]);
    expect(track?.itunesId).toBe(7);
  });

  // Last.fm 沒有任何熱門歌：沒有歌名可以搜，回 null，也不必問 iTunes
  it("returns null when Last.fm has no top track", async () => {
    const { lastfm, itunes, calls } = fakes({ top: [] });

    expect(await getArtistTrack({ db, lastfm, itunes, now }, "Nobody")).toBeNull();
    expect(calls.searchTracks).toEqual([]);
  });

  // 「iTunes 沒有這首歌」要記住，「iTunes 暫時壞了」不能記住，不然 30 天都沒有試聽
  it("does not cache anything when iTunes fails", async () => {
    const { lastfm, itunes } = fakes();
    itunes.searchTracks = async () => {
      throw new ItunesError("search: HTTP 403, response is not JSON", 403);
    };

    await expect(getArtistTrack({ db, lastfm, itunes, now }, "Radiohead")).rejects.toBeInstanceOf(ItunesError);
    expect(await db.select().from(tracks)).toEqual([]);
  });

  // 台灣商店沒有、美國商店出錯：還不知道「真的沒有」，所以也不存
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
