import { describe, expect, it } from "vitest";
import { tasteCheckLocation, homeLocation, parseRecommendationsQuery, recommendationsLocation, seedsLabel } from "./recommendations-route";

describe("parseRecommendationsQuery", () => {
  it("reads one or many seeds and the explore path", () => {
    expect(parseRecommendationsQuery({ seed: "Tame Impala" })).toEqual({ seeds: ["Tame Impala"], explore: [] });
    expect(parseRecommendationsQuery({ seed: ["Tame Impala", "Kokoroko"], explore: ["Pond", "GUM"] })).toEqual({
      seeds: ["Tame Impala", "Kokoroko"],
      explore: ["Pond", "GUM"],
    });
  });

  it("cleans up hand-edited seeds", () => {
    expect(parseRecommendationsQuery({ seed: [" Tame Impala ", "", "tame impala", "Kokoroko"] })?.seeds).toEqual([
      "Tame Impala",
      "Kokoroko",
    ]);
  });

  it("returns null without any seed", () => {
    expect(parseRecommendationsQuery({})).toBeNull();
    expect(parseRecommendationsQuery({ seed: "  " })).toBeNull();
  });

  it("keeps at most three seeds and three explored levels", () => {
    const parsed = parseRecommendationsQuery({ seed: ["A", "B", "C", "D"], explore: ["E", "F", "G", "H"] });
    expect(parsed).toEqual({ seeds: ["A", "B", "C"], explore: ["E", "F", "G"] });
  });
});

describe("links", () => {
  it("builds the recommendations location, with the path when exploring", () => {
    expect(recommendationsLocation(["Tame Impala", "Kokoroko"])).toEqual({
      path: "/recommendations",
      query: { seed: ["Tame Impala", "Kokoroko"] },
    });
    expect(recommendationsLocation(["Tame Impala"], ["Pond"])).toEqual({
      path: "/recommendations",
      query: { seed: ["Tame Impala"], explore: ["Pond"] },
    });
  });

  it("builds the home location with the seeds", () => {
    expect(homeLocation(["Tame Impala", "Kokoroko"])).toEqual({ path: "/", query: { seed: ["Tame Impala", "Kokoroko"] } });
  });

  it("builds the taste check location with the seeds", () => {
    expect(tasteCheckLocation(["Tame Impala", "Kokoroko"])).toEqual({ path: "/taste-check", query: { seed: ["Tame Impala", "Kokoroko"] } });
  });

  it("labels the seeds for the breadcrumb", () => {
    expect(seedsLabel(["Tame Impala"])).toBe("Tame Impala");
    expect(seedsLabel(["Tame Impala", "Kokoroko", "Pond"])).toBe("Tame Impala + Kokoroko + Pond");
  });
});
