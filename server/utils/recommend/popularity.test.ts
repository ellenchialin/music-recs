import { describe, expect, it } from "vitest";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";
import { rerankByPopularity } from "./popularity";
import type { Candidate } from "./types";

// Candidates arrive most similar first; the number is each artist's Last.fm listener count
function pool(entries: [string, number | null][]) {
  const candidates: Candidate[] = entries.map(([name], i) => ({
    name,
    nameNorm: normalizeArtistName(name),
    mbid: null,
    score: 1 / (i + 1),
    sources: ["Seed"],
  }));
  const listeners = new Map(entries.map(([name, count]) => [normalizeArtistName(name), count]));
  return { candidates, listeners };
}
const names = (list: Candidate[]) => list.map((c) => c.name);

describe("rerankByPopularity", () => {
  it("leaves the similarity order alone when balanced", () => {
    const { candidates, listeners } = pool([["Niche", 900], ["Huge", 5_000_000], ["Middle", 80_000]]);

    expect(rerankByPopularity(candidates, listeners, "balanced")).toEqual(candidates);
  });

  it("moves widely heard artists up for mainstream", () => {
    const { candidates, listeners } = pool([["Niche", 900], ["Middle", 80_000], ["Huge", 5_000_000]]);

    expect(names(rerankByPopularity(candidates, listeners, "mainstream"))).toEqual(["Huge", "Middle", "Niche"]);
  });

  it("moves little-heard artists up for obscure", () => {
    const { candidates, listeners } = pool([["Huge", 5_000_000], ["Middle", 80_000], ["Niche", 900]]);

    expect(names(rerankByPopularity(candidates, listeners, "obscure"))).toEqual(["Niche", "Middle", "Huge"]);
  });

  it("keeps the similarity order between artists with the same listener count", () => {
    const { candidates, listeners } = pool([["First", 80_000], ["Second", 80_000]]);

    expect(names(rerankByPopularity(candidates, listeners, "mainstream"))).toEqual(["First", "Second"]);
    expect(names(rerankByPopularity(candidates, listeners, "obscure"))).toEqual(["First", "Second"]);
  });

  it("still counts similarity: a slightly bigger artist far down the list doesn't jump to the top", () => {
    const { candidates, listeners } = pool([
      ["Close and big", 900_000],
      ["B", 50_000],
      ["C", 40_000],
      ["D", 30_000],
      ["E", 20_000],
      ["Far and biggest", 1_000_000],
    ]);

    expect(names(rerankByPopularity(candidates, listeners, "mainstream"))[0]).toBe("Close and big");
  });

  // A failed lookup shouldn't read as "nobody listens to them" or as "everybody does"
  it("gives artists without a listener count no boost in either direction", () => {
    const { candidates, listeners } = pool([["Unknown", null], ["Known", 80_000]]);

    expect(names(rerankByPopularity(candidates, listeners, "mainstream"))).toEqual(["Known", "Unknown"]);
    expect(names(rerankByPopularity(candidates, listeners, "obscure"))).toEqual(["Known", "Unknown"]);
  });

  it("keeps each artist's similarity score and doesn't change the input", () => {
    const { candidates, listeners } = pool([["Niche", 900], ["Huge", 5_000_000]]);
    const before = structuredClone(candidates);

    const result = rerankByPopularity(candidates, listeners, "mainstream");

    expect(candidates).toEqual(before);
    expect(result.find((c) => c.name === "Huge")?.score).toBe(0.5);
  });
});
