import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { artistSimilar, artists } from "../db/schema";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import info from "../lastfm/fixtures/info-radiohead.json";
import similar from "../lastfm/fixtures/similar-radiohead.json";
import { artistInfoResponse, similarArtistsResponse, type ArtistInfo, type SimilarArtist } from "../lastfm/schemas";
import { getArtist, getSimilarArtists } from "./lastfm";

const db = getDb();
const radioheadInfo = artistInfoResponse.parse(info.body);
const radioheadSimilar = similarArtistsResponse.parse(similar.body);

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-03T12:00:00Z");
const later = (days: number) => new Date(now.getTime() + days * day);

// 假的 Last.fm client：回傳錄好的資料，並記錄被呼叫幾次。快取有沒有用，就看次數
function fakeLastfm({ info = radioheadInfo, similar = radioheadSimilar }: { info?: ArtistInfo; similar?: SimilarArtist[] } = {}) {
  const calls = { getInfo: 0, getSimilar: 0 };
  const lastfm: Pick<LastfmClient, "getInfo" | "getSimilar"> = {
    getInfo: async () => {
      calls.getInfo++;
      return info;
    },
    getSimilar: async () => {
      calls.getSimilar++;
      return similar;
    },
  };
  return { lastfm, calls };
}

beforeEach(async () => {
  await db.execute(sql`truncate artists restart identity cascade`);
});

describe("getArtist", () => {
  it("fetches from Last.fm once and stores the artist", async () => {
    const { lastfm, calls } = fakeLastfm();

    const artist = await getArtist({ db, lastfm, now }, "Radiohead");

    expect(calls.getInfo).toBe(1);
    expect(artist).toMatchObject({ name: "Radiohead", nameNorm: "radiohead", listeners: 8500398, fetchedAt: now });
    expect(artist.tags.slice(0, 2)).toEqual(["rock", "alternative"]);
    expect(await db.select().from(artists)).toHaveLength(1);
  });

  // 快取的重點：第二次不打 API。寫法不同（大小寫、空白）也算同一位
  it("serves a cached artist without calling Last.fm", async () => {
    const { lastfm, calls } = fakeLastfm();
    await getArtist({ db, lastfm, now }, "Radiohead");

    const artist = await getArtist({ db, lastfm, now: later(29) }, " radiohead");

    expect(calls.getInfo).toBe(1);
    expect(artist.name).toBe("Radiohead");
  });

  // 過期就重抓，而且是更新同一列（id 不變），不是新增一列
  it("refetches after 30 days and updates the same row", async () => {
    const first = await getArtist({ db, lastfm: fakeLastfm().lastfm, now }, "Radiohead");
    const { lastfm, calls } = fakeLastfm({ info: { ...radioheadInfo, listeners: 9000000 } });

    const artist = await getArtist({ db, lastfm, now: later(31) }, "Radiohead");

    expect(calls.getInfo).toBe(1);
    expect(artist).toMatchObject({ id: first.id, listeners: 9000000, fetchedAt: later(31) });
    expect(await db.select().from(artists)).toHaveLength(1);
  });

  // 找不到的歌手：錯誤往上丟，資料庫不留東西
  it("stores nothing when Last.fm does not know the artist", async () => {
    const lastfm = fakeLastfm().lastfm;
    lastfm.getInfo = async () => {
      throw new LastfmError("artist.getInfo: The artist you supplied could not be found", 200, 6);
    };

    await expect(getArtist({ db, lastfm, now }, "zzqx")).rejects.toMatchObject({ code: 6 });
    expect(await db.select().from(artists)).toEqual([]);
  });
});

describe("getSimilarArtists", () => {
  it("fetches the similar list once and stores it, best match first", async () => {
    const { lastfm, calls } = fakeLastfm();
    const radiohead = await getArtist({ db, lastfm, now }, "Radiohead");

    const list = await getSimilarArtists({ db, lastfm, now }, radiohead);

    expect(calls.getSimilar).toBe(1);
    expect(list).toHaveLength(10);
    expect(list[0]).toEqual({ name: "Thom Yorke", nameNorm: "thom yorke", mbid: expect.any(String), match: 1 });
    const [row] = await db.select().from(artists).where(eq(artists.id, radiohead.id));
    expect(row?.similarFetchedAt).toEqual(now);
  });

  it("serves a cached list without calling Last.fm", async () => {
    const { lastfm, calls } = fakeLastfm();
    const radiohead = await getArtist({ db, lastfm, now }, "Radiohead");
    await getSimilarArtists({ db, lastfm, now }, radiohead);

    // 重新讀一次歌手：這時 similarFetchedAt 已經有值
    const cached = await getArtist({ db, lastfm, now: later(1) }, "Radiohead");
    const list = await getSimilarArtists({ db, lastfm, now: later(1) }, cached);

    expect(calls.getSimilar).toBe(1);
    expect(list.map((a) => a.name)).toEqual(radioheadSimilar.map((a) => a.name));
  });

  // 過期時整份換新：舊清單裡、新清單沒有的歌手要消失
  it("replaces the whole list when it is stale", async () => {
    const radiohead = await getArtist({ db, lastfm: fakeLastfm().lastfm, now }, "Radiohead");
    await getSimilarArtists({ db, lastfm: fakeLastfm().lastfm, now }, radiohead);
    const { lastfm } = fakeLastfm({ similar: [{ name: "Portishead", mbid: null, match: 0.4 }] });

    const stale = await getArtist({ db, lastfm, now: later(29) }, "Radiohead");
    const list = await getSimilarArtists({ db, lastfm, now: later(31) }, stale);

    expect(list).toEqual([{ name: "Portishead", nameNorm: "portishead", mbid: null, match: 0.4 }]);
    expect(await db.select().from(artistSimilar)).toHaveLength(1);
  });

  // Last.fm 偶爾會回兩個只差大小寫的名字；正規化後重複，只留 match 高的那個，不要整批失敗
  it("keeps one entry when two names normalize to the same thing", async () => {
    const { lastfm } = fakeLastfm({
      similar: [
        { name: "Utada", mbid: null, match: 0.9 },
        { name: "UTADA", mbid: null, match: 0.3 },
      ],
    });
    const artist = await getArtist({ db, lastfm, now }, "Radiohead");

    const list = await getSimilarArtists({ db, lastfm, now }, artist);

    expect(list).toEqual([{ name: "Utada", nameNorm: "utada", mbid: null, match: 0.9 }]);
  });
});
