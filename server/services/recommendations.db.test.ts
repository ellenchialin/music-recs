import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { ItunesError, type ItunesClient } from "../itunes/client";
import type { ItunesTrack } from "../itunes/schemas";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import type { ArtistSearchResult } from "../lastfm/schemas";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { ALGO_VERSION } from "../utils/recommend/recommend";
import { SeedNotFoundError, getRecommendations } from "./recommendations";

const db = getDb();
const now = new Date("2026-11-04T12:00:00Z");

// 假的世界：幾位歌手的資料。Last.fm 和 iTunes 都從這裡回答，並記錄被呼叫幾次
type FakeArtist = { name: string; mbid?: string; similar?: [string, number][]; top?: string };
type FakePreview = "found" | "none" | "error";

function fakeWorld(
  artists: FakeArtist[],
  { previews = {}, search = [] }: { previews?: Record<string, FakePreview>; search?: ArtistSearchResult[] } = {},
) {
  const calls = { lastfm: 0, itunes: 0 };
  const find = (name: string) => artists.find((a) => normalizeArtistName(a.name) === normalizeArtistName(name));
  const notFound = () => new LastfmError("The artist you supplied could not be found", 200, 6);

  const lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists"> = {
    getInfo: async (name) => {
      calls.lastfm++;
      const a = find(name);
      if (!a) throw notFound();
      return { name: a.name, mbid: a.mbid ?? null, listeners: 1000, tags: [] };
    },
    getSimilar: async (name) => {
      calls.lastfm++;
      return (find(name)?.similar ?? []).map(([n, match]) => ({ name: n, mbid: null, match }));
    },
    getTopTracks: async (name) => {
      calls.lastfm++;
      const top = find(name)?.top ?? `${name} Hit`;
      return [{ name: top, mbid: null, playcount: 1, listeners: 1 }];
    },
    searchArtists: async () => {
      calls.lastfm++;
      return search;
    },
  };

  // iTunes：搜尋字串是「歌手 歌名」，從開頭認出是哪位歌手（種子和所有相似歌手裡找）
  const known = artists.flatMap((a) => [a.name, ...(a.similar ?? []).map(([n]) => n)]);
  const itunes: Pick<ItunesClient, "searchTracks"> = {
    searchTracks: async (term) => {
      calls.itunes++;
      const artist = known.find((n) => term.startsWith(`${n} `)) ?? "";
      const mode = previews[artist] ?? "found";
      if (mode === "error") throw new ItunesError("search: HTTP 403, response is not JSON", 403);
      if (mode === "none") return [];
      const title = term.slice(artist.length + 1);
      const track: ItunesTrack = {
        id: 1,
        name: title,
        artist: term.slice(0, term.length - title.length - 1),
        album: null,
        previewUrl: `https://audio.example/${encodeURIComponent(term)}.m4a`,
        artworkUrl: "https://art.example/600x600bb.jpg",
      };
      return [track];
    },
  };
  return { lastfm, itunes, calls };
}

// 歐美歌手：Tame Impala 和 Kokoroko 當種子，兩位都和 Khruangbin 相似
const world = (options?: Parameters<typeof fakeWorld>[1]) =>
  fakeWorld(
    [
      { name: "Tame Impala", mbid: "tame", similar: [["Pond", 0.9], ["Khruangbin", 0.5], ["MGMT", 0.6]] },
      { name: "Kokoroko", mbid: "koko", similar: [["Ezra Collective", 0.8], ["Khruangbin", 0.4]] },
    ],
    options,
  );

beforeEach(async () => {
  await db.execute(sql`truncate artists, tracks restart identity cascade`);
});

describe("getRecommendations", () => {
  it("recommends artists with a preview for each card", async () => {
    const { lastfm, itunes } = world();

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["tame impala", "Kokoroko"] });

    expect(result.algoVersion).toBe(ALGO_VERSION);
    // 種子用 Last.fm 的正式寫法回傳，前端顯示用
    expect(result.seeds).toEqual(["Tame Impala", "Kokoroko"]);
    // Khruangbin 兩位種子都推（Tame Impala 第 3 名、Kokoroko 第 2 名），排第一；
    // 接著是兩位種子各自的第 1 名，分數一樣依名字排
    expect(result.recommendations.map((r) => r.artist)).toEqual(["Khruangbin", "Ezra Collective", "Pond", "MGMT"]);
    expect(result.recommendations[0]).toEqual({
      artist: "Khruangbin",
      score: expect.closeTo(1 / 8 + 1 / 7, 6),
      sources: ["Tame Impala", "Kokoroko"],
      track: { title: "Khruangbin Hit", artworkUrl: "https://art.example/600x600bb.jpg" },
      preview: { status: "available", url: expect.stringMatching(/^https:\/\/audio\.example\//) },
    });
  });

  // 三個商店都沒有：卡片照常回傳，只是沒有試聽
  it("marks a card unavailable when no store has the track", async () => {
    const { lastfm, itunes } = world({ previews: { Pond: "none" } });

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala"] });

    const pond = result.recommendations.find((r) => r.artist === "Pond");
    expect(pond?.track).toEqual({ title: "Pond Hit", artworkUrl: null });
    expect(pond?.preview).toEqual({ status: "unavailable" });
  });

  // iTunes 暫時壞了：只有那張卡片是 error，其他卡片不受影響，整個請求也不失敗
  it("isolates a preview error to its own card", async () => {
    const { lastfm, itunes } = world({ previews: { Pond: "error" } });

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala"] });

    const byArtist = Object.fromEntries(result.recommendations.map((r) => [r.artist, r.preview.status]));
    expect(byArtist).toEqual({ Pond: "error", MGMT: "available", Khruangbin: "available" });
    expect(result.recommendations.find((r) => r.artist === "Pond")?.track).toBeNull();
  });

  // 驗收標準：同一組種子重複查詢，不再呼叫外部 API
  it("answers a repeated query from the cache alone", async () => {
    const { lastfm, itunes, calls } = world();
    await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", "Kokoroko"] });
    calls.lastfm = 0;
    calls.itunes = 0;

    await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", "Kokoroko"] });

    expect(calls).toEqual({ lastfm: 0, itunes: 0 });
  });

  // 同一位歌手輸入兩次（大小寫不同）只算一位種子，分數不會因此加倍
  it("ignores a seed entered twice", async () => {
    const { lastfm, itunes } = world();

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", " tame impala"] });

    expect(result.seeds).toEqual(["Tame Impala"]);
    // 只算一次：Pond 是唯一一位種子的第 1 名，分數 1/6，不是 2/6
    expect(result.recommendations[0]).toMatchObject({ artist: "Pond", score: expect.closeTo(1 / 6, 6) });
  });

  // 找不到種子：丟 SeedNotFoundError，附上搜尋到的相近歌手；聽眾太少的分身（例如 radıohead）不列
  it("suggests similar names when a seed is not found", async () => {
    const { lastfm, itunes } = world({
      search: [
        { name: "Tame Impala", mbid: "tame", listeners: 3_000_000 },
        { name: "Tame lmpala", mbid: null, listeners: 42 },
      ],
    });

    const err = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Kokoroko", "Tame Impalla"] }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(SeedNotFoundError);
    expect(err).toMatchObject({ seed: "Tame Impalla", suggestions: ["Tame Impala"] });
  });
});
