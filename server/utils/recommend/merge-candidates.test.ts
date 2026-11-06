import { describe, expect, it } from "vitest";
import { RANK_K, mergeCandidates } from "./merge-candidates";
import type { SeedSimilarity } from "./types";

function seed(name: string, similar: [string, number][], weight = 1): SeedSimilarity {
  return {
    seed: name,
    seedMbid: null,
    weight,
    similar: similar.map(([n, match]) => ({ name: n, nameNorm: n.toLowerCase(), mbid: null, match })),
  };
}

const rankScore = (rank: number, weight = 1) => Math.round((weight / (RANK_K + rank)) * 1e6) / 1e6;

describe("mergeCandidates", () => {
  it("ranks a single seed's list by match, best first", () => {
    const result = mergeCandidates([seed("Radiohead", [["Portishead", 0.4], ["Thom Yorke", 1]])]);
    expect(result).toEqual([
      { name: "Thom Yorke", nameNorm: "thom yorke", mbid: null, score: rankScore(1), sources: ["Radiohead"] },
      { name: "Portishead", nameNorm: "portishead", mbid: null, score: rankScore(2), sources: ["Radiohead"] },
    ]);
  });

  // v1's problem: a seed with tightly packed top matches (0.99, 0.98, 0.97) took most spots
  it("gives every seed a fair share of the top spots", () => {
    const result = mergeCandidates([
      seed("Kokoroko", [["A1", 0.99], ["A2", 0.98], ["A3", 0.97]]),
      seed("Tame Impala", [["B1", 0.5], ["B2", 0.3]]),
    ]);
    expect(result.map((c) => c.name)).toEqual(["A1", "B1", "A2", "B2", "A3"]);
  });

  it("ranks an artist shared by several seeds above any single seed's best", () => {
    const result = mergeCandidates([
      seed("Tame Impala", [["Pond", 0.9], ["Khruangbin", 0.5]]),
      seed("Kokoroko", [["Ezra Collective", 0.8], ["Khruangbin", 0.4]]),
    ]);
    expect(result[0]).toMatchObject({ name: "Khruangbin", score: rankScore(2) * 2 });
  });

  it("lists every seed the artist came from, in seed order", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Khruangbin", 0.5]]), seed("Kokoroko", [["Khruangbin", 0.4]])]);
    expect(result[0]?.sources).toEqual(["Tame Impala", "Kokoroko"]);
  });

  it("multiplies each seed's contribution by its weight", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Pond", 0.8]], 0.5)]);
    expect(result[0]?.score).toBe(rankScore(1, 0.5));
  });

  // The blind test needs the same seeds to give the same order every time
  it("breaks ties by name so the order is always the same", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Pond", 0.9]]), seed("Kokoroko", [["Ezra Collective", 0.8]])]);
    expect(result.map((c) => c.name)).toEqual(["Ezra Collective", "Pond"]);
  });

  it("rounds scores to six decimals", () => {
    const [first] = mergeCandidates([seed("Tame Impala", [["Pond", 0.9]])]);
    expect(String(first?.score).split(".")[1]?.length).toBeLessThanOrEqual(6);
  });

  it("returns an empty list for no seeds", () => {
    expect(mergeCandidates([])).toEqual([]);
  });
});
