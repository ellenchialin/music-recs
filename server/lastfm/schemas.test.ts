import { describe, expect, it } from "vitest";
import info from "./fixtures/info-radiohead.json";
import search from "./fixtures/search-radiohead.json";
import similar from "./fixtures/similar-radiohead.json";
import toptags from "./fixtures/toptags-radiohead.json";
import toptracks from "./fixtures/toptracks-radiohead.json";
import {
  artistInfoResponse,
  artistSearchResponse,
  similarArtistsResponse,
  topTagsResponse,
  topTracksResponse,
} from "./schemas";

// Fixtures are recorded from the real API with `pnpm record:lastfm`

describe("artistSearchResponse", () => {
  it("turns string numbers into numbers and empty MBIDs into null", () => {
    const artists = artistSearchResponse.parse(search.body);
    expect(artists[0]).toEqual({
      name: "Radiohead",
      mbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
      listeners: 8500398,
    });
    expect(artists[1]?.mbid).toBeNull();
  });

  it("keeps only the fields we use", () => {
    const [first] = artistSearchResponse.parse(search.body);
    expect(Object.keys(first ?? {})).toEqual(["name", "mbid", "listeners"]);
  });
});

describe("similarArtistsResponse", () => {
  it("parses match as a number between 0 and 1", () => {
    const artists = similarArtistsResponse.parse(similar.body);
    expect(artists).toHaveLength(10);
    expect(artists[0]).toMatchObject({ name: "Thom Yorke", match: 1 });
    for (const a of artists) {
      expect(a.match).toBeGreaterThanOrEqual(0);
      expect(a.match).toBeLessThanOrEqual(1);
    }
  });

  // Hand-made: Last.fm's XML-derived JSON turns a one-item array into an object
  it("accepts a single artist object instead of an array", () => {
    const one = { similarartists: { artist: { name: "Thom Yorke", mbid: "", match: "0.5" } } };
    expect(similarArtistsResponse.parse(one)).toEqual([{ name: "Thom Yorke", mbid: null, match: 0.5 }]);
  });

  it("rejects a response missing the artist name", () => {
    const broken = { similarartists: { artist: [{ mbid: "", match: "0.5" }] } };
    expect(() => similarArtistsResponse.parse(broken)).toThrow();
  });
});

describe("topTagsResponse", () => {
  it("returns tag names with their weight", () => {
    const tags = topTagsResponse.parse(toptags.body);
    expect(tags[0]).toEqual({ name: "rock", count: 100 });
  });
});

describe("topTracksResponse", () => {
  it("returns tracks with numeric play and listener counts", () => {
    const tracks = topTracksResponse.parse(toptracks.body);
    expect(tracks).toHaveLength(5);
    expect(tracks[0]).toEqual({
      name: "Creep",
      mbid: "012e70cd-4ef6-37bf-8ebf-02d318fe5151",
      playcount: 64088857,
      listeners: 4260346,
    });
  });
});

describe("artistInfoResponse", () => {
  it("returns listeners and tag names", () => {
    const artist = artistInfoResponse.parse(info.body);
    expect(artist).toMatchObject({ name: "Radiohead", listeners: 8500398 });
    expect(artist.tags.slice(0, 2)).toEqual(["rock", "alternative"]);
  });
});
