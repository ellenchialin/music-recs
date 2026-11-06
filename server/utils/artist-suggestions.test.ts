import { describe, expect, it } from "vitest";
import search from "../lastfm/fixtures/search-radiohead.json";
import { artistSearchResponse, type ArtistSearchResult } from "../lastfm/schemas";
import { toArtistSuggestions } from "./artist-suggestions";

const result = (name: string, listeners: number): ArtistSearchResult => ({ name, mbid: null, listeners });

describe("toArtistSuggestions", () => {
  // Real data: the second hit for "radiohead" is the misspelled "radıohead" (117 listeners)
  it("drops lookalikes with few listeners", () => {
    const names = toArtistSuggestions(artistSearchResponse.parse(search.body)).map((s) => s.name);
    expect(names[0]).toBe("Radiohead");
    expect(names).not.toContain("radıohead");
  });

  it("keeps the name and listener count, in Last.fm's order", () => {
    expect(toArtistSuggestions([result("Tame Impala", 3_000_000), result("Tame Impala Tribute", 5_000)])).toEqual([
      { name: "Tame Impala", listeners: 3_000_000 },
      { name: "Tame Impala Tribute", listeners: 5_000 },
    ]);
  });

  it("keeps one entry per normalized name", () => {
    const names = toArtistSuggestions([result("Kokoroko", 200_000), result("KOKOROKO", 3_000)]).map((s) => s.name);
    expect(names).toEqual(["Kokoroko"]);
  });

  // Real data: "Tame \u0130mpala" (Turkish dotted I) has 1,965 listeners, above the threshold
  it("drops lookalikes that differ only by accents or dotted letters", () => {
    const names = toArtistSuggestions([
      result("Tame Impala", 4_697_353),
      result("Tame \u0130mpala", 1_965),
      result("rad\u0131ohead", 2_000),
      result("Radiohead", 8_500_000),
    ]).map((s) => s.name);
    expect(names).toEqual(["Tame Impala", "Radiohead"]);
  });

  it("returns at most the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => result(`Artist ${i}`, 10_000));
    expect(toArtistSuggestions(many, 8)).toHaveLength(8);
  });
});
