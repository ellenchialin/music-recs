import { describe, expect, it } from "vitest";
import { LastfmError } from "../lastfm/client";
import type { ArtistSearchResult } from "../lastfm/schemas";
import { searchArtistSuggestions } from "./artist-search";

const artist = (name: string, listeners = 100_000): ArtistSearchResult => ({ name, mbid: null, listeners });

// Like Last.fm: whole words only, so a half-typed word finds nothing
function fakeLastfm(results: Record<string, ArtistSearchResult[]>, { failWider = false } = {}) {
  const calls: string[] = [];
  const lastfm = async (q: string) => {
    calls.push(q);
    if (failWider && calls.length > 1) throw new LastfmError("artist.search: HTTP 500", 500);
    return results[q] ?? [];
  };
  return { lastfm, calls };
}

describe("searchArtistSuggestions", () => {
  it("finds a name whose last word is only half typed", async () => {
    const { lastfm } = fakeLastfm({ hiatus: [artist("Hiatus"), artist("Hiatus Kaiyote"), artist("the HIATUS")] });
    expect((await searchArtistSuggestions(lastfm, "hiatus kai")).map((s) => s.name)).toEqual(["Hiatus Kaiyote"]);
  });

  it("puts names that start with what's typed before Last.fm's looser matches", async () => {
    const { lastfm } = fakeLastfm({
      "tame impala": [artist("Tame Impala Tribute"), artist("Tame Impala")],
      tame: [artist("Tame Impala"), artist("Tamer")],
    });
    expect((await searchArtistSuggestions(lastfm, "tame impala")).map((s) => s.name)).toEqual([
      "Tame Impala",
      "Tame Impala Tribute",
    ]);
  });

  it("searches once for a single word", async () => {
    const { lastfm, calls } = fakeLastfm({ mitsk: [artist("Mitski")] });
    expect((await searchArtistSuggestions(lastfm, "mitsk")).map((s) => s.name)).toEqual(["Mitski"]);
    expect(calls).toEqual(["mitsk"]);
  });

  // The extra search is a bonus; the main one still answers
  it("ignores a failed extra search", async () => {
    const { lastfm } = fakeLastfm({ "beach house": [artist("Beach House")] }, { failWider: true });
    expect((await searchArtistSuggestions(lastfm, "beach house")).map((s) => s.name)).toEqual(["Beach House"]);
  });
});
