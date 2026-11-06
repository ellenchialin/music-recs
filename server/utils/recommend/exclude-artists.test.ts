import { describe, expect, it } from "vitest";
import { excludeArtists } from "./exclude-artists";
import type { Candidate } from "./types";

function candidate(name: string, mbid: string | null = null): Candidate {
  return { name, nameNorm: name.toLowerCase(), mbid, score: 1, sources: ["Radiohead"] };
}

describe("excludeArtists", () => {
  it("removes artists by normalized name", () => {
    const candidates = [candidate("Thom Yorke"), candidate("Portishead")];
    const result = excludeArtists(candidates, [{ nameNorm: "thom yorke", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["Portishead"]);
  });

  it("removes a different name with the same MBID", () => {
    const candidates = [candidate("Hikaru Utada", "b539e453"), candidate("Boa", "99dd9355")];
    const result = excludeArtists(candidates, [{ nameNorm: "宇多田ヒカル", mbid: "b539e453" }]);
    expect(result.map((c) => c.name)).toEqual(["Boa"]);
  });

  // Many artists have no MBID; two nulls are not the same artist
  it("never treats two missing MBIDs as the same artist", () => {
    const candidates = [candidate("Utada", null), candidate("Boa", null)];
    const result = excludeArtists(candidates, [{ nameNorm: "宇多田ヒカル", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["Utada", "Boa"]);
  });

  it("keeps the order of the remaining candidates", () => {
    const candidates = ["A", "B", "C", "D"].map((n) => candidate(n));
    const result = excludeArtists(candidates, [{ nameNorm: "b", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["A", "C", "D"]);
  });

  it("returns everything when nothing is excluded", () => {
    const candidates = [candidate("A"), candidate("B")];
    expect(excludeArtists(candidates, [])).toEqual(candidates);
  });
});
