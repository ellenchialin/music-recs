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

// A small fake world both fake clients answer from, counting calls
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

  // iTunes terms are "artist title"; find the artist by prefix
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

// Tame Impala and Kokoroko as seeds; both are similar to Khruangbin
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
    expect(result.seeds).toEqual(["Tame Impala", "Kokoroko"]);
    // Khruangbin is #3 and #2 for the two seeds, so it beats each seed's #1; ties sort by name
    expect(result.recommendations.map((r) => r.artist)).toEqual(["Khruangbin", "Ezra Collective", "Pond", "MGMT"]);
    expect(result.recommendations[0]).toEqual({
      artist: "Khruangbin",
      score: expect.closeTo(1 / 8 + 1 / 7, 6),
      sources: ["Tame Impala", "Kokoroko"],
      track: { title: "Khruangbin Hit", artworkUrl: "https://art.example/600x600bb.jpg" },
      preview: { status: "available", url: expect.stringMatching(/^https:\/\/audio\.example\//) },
    });
  });

  it("marks a card unavailable when no store has the track", async () => {
    const { lastfm, itunes } = world({ previews: { Pond: "none" } });

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala"] });

    const pond = result.recommendations.find((r) => r.artist === "Pond");
    expect(pond?.track).toEqual({ title: "Pond Hit", artworkUrl: null });
    expect(pond?.preview).toEqual({ status: "unavailable" });
  });

  it("isolates a preview error to its own card", async () => {
    const { lastfm, itunes } = world({ previews: { Pond: "error" } });

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala"] });

    const byArtist = Object.fromEntries(result.recommendations.map((r) => [r.artist, r.preview.status]));
    expect(byArtist).toEqual({ Pond: "error", MGMT: "available", Khruangbin: "available" });
    expect(result.recommendations.find((r) => r.artist === "Pond")?.track).toBeNull();
  });

  it("answers a repeated query from the cache alone", async () => {
    const { lastfm, itunes, calls } = world();
    await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", "Kokoroko"] });
    calls.lastfm = 0;
    calls.itunes = 0;

    await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", "Kokoroko"] });

    expect(calls).toEqual({ lastfm: 0, itunes: 0 });
  });

  it("ignores a seed entered twice", async () => {
    const { lastfm, itunes } = world();

    const result = await getRecommendations({ db, lastfm, itunes, now }, { seeds: ["Tame Impala", " tame impala"] });

    expect(result.seeds).toEqual(["Tame Impala"]);
    expect(result.recommendations[0]).toMatchObject({ artist: "Pond", score: expect.closeTo(1 / 6, 6) });
  });

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

  it("leaves out the artists to exclude", async () => {
    const { lastfm, itunes } = world();

    const result = await getRecommendations(
      { db, lastfm, itunes, now },
      { seeds: ["Tame Impala"], exclude: ["pond", "Khruangbin "] },
    );

    expect(result.recommendations.map((r) => r.artist)).toEqual(["MGMT"]);
  });
});
