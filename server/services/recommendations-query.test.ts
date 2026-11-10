import { describe, expect, it } from "vitest";
import { previewQuery, recommendationsQuery } from "./recommendations-query";

describe("recommendationsQuery", () => {
  it("turns one seed into a list", () => {
    expect(recommendationsQuery.parse({ seed: "Tame Impala" })).toEqual({ seeds: ["Tame Impala"], exclude: [] });
  });

  it("keeps several seeds in order and trims them", () => {
    expect(recommendationsQuery.parse({ seed: [" Tame Impala ", "Kokoroko"] })).toEqual({
      seeds: ["Tame Impala", "Kokoroko"],
      exclude: [],
    });
  });

  it("accepts one to three seeds", () => {
    expect(recommendationsQuery.safeParse({}).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: ["A", "B", "C", "D"] }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: ["A", "B", "C"] }).success).toBe(true);
  });

  it("rejects empty or very long names", () => {
    expect(recommendationsQuery.safeParse({ seed: "  " }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: "x".repeat(201) }).success).toBe(false);
  });

  it("accepts artists to exclude, one or many", () => {
    expect(recommendationsQuery.parse({ seed: "GUM", exclude: "Pond" }).exclude).toEqual(["Pond"]);
    expect(recommendationsQuery.parse({ seed: "GUM", exclude: [" Pond ", "Tame Impala"] }).exclude).toEqual([
      "Pond",
      "Tame Impala",
    ]);
  });

  it("accepts at most 60 artists to exclude", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `Artist ${i}`);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: names(60) }).success).toBe(true);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: names(61) }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: " " }).success).toBe(false);
  });
});

describe("previewQuery", () => {
  it("takes one trimmed artist name", () => {
    expect(previewQuery.parse({ artist: " Pond " })).toEqual({ artist: "Pond" });
  });

  it("rejects a missing, empty, repeated or very long name", () => {
    for (const query of [{}, { artist: " " }, { artist: ["Pond", "MGMT"] }, { artist: "x".repeat(201) }]) {
      expect(previewQuery.safeParse(query).success).toBe(false);
    }
  });
});
