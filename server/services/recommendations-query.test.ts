import { describe, expect, it } from "vitest";
import { previewsQuery, reasonsQuery, recommendationsQuery } from "./recommendations-query";

describe("recommendationsQuery", () => {
  it("turns one seed into a list", () => {
    expect(recommendationsQuery.parse({ seed: "Tame Impala" })).toEqual({ seeds: ["Tame Impala"], exclude: [], popularity: "balanced" });
  });

  it("keeps several seeds in order and trims them", () => {
    expect(recommendationsQuery.parse({ seed: [" Tame Impala ", "Kokoroko"] })).toEqual({
      seeds: ["Tame Impala", "Kokoroko"],
      exclude: [],
      popularity: "balanced",
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

  it("accepts a slider setting and refuses anything else", () => {
    expect(recommendationsQuery.parse({ seed: "GUM", popularity: "obscure" }).popularity).toBe("obscure");
    expect(recommendationsQuery.parse({ seed: "GUM", popularity: "mainstream" }).popularity).toBe("mainstream");
    expect(recommendationsQuery.safeParse({ seed: "GUM", popularity: "louder" }).success).toBe(false);
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

describe("previewsQuery", () => {
  // One request for every record still waiting on a preview, in the order to look them up
  it("takes one or many trimmed artist names, in order", () => {
    expect(previewsQuery.parse({ artist: " Pond " })).toEqual({ artists: ["Pond"] });
    expect(previewsQuery.parse({ artist: ["GUM", " Pond"] })).toEqual({ artists: ["GUM", "Pond"] });
  });

  it("takes at most a page of records", () => {
    expect(previewsQuery.safeParse({ artist: Array.from({ length: 10 }, (_, i) => `A${i}`) }).success).toBe(true);
    expect(previewsQuery.safeParse({ artist: Array.from({ length: 11 }, (_, i) => `A${i}`) }).success).toBe(false);
  });

  it("rejects a missing, empty or very long name", () => {
    for (const query of [{}, { artist: " " }, { artist: "x".repeat(201) }]) {
      expect(previewsQuery.safeParse(query).success).toBe(false);
    }
  });
});

describe("reasonsQuery", () => {
  it("takes the same query as the list, plus the record on screen", () => {
    expect(reasonsQuery.parse({ seed: "GUM", exclude: "Pond", popularity: "obscure", first: " Khruangbin " })).toEqual({
      seeds: ["GUM"],
      exclude: ["Pond"],
      popularity: "obscure",
      first: "Khruangbin",
    });
  });

  it("works without a record on screen", () => {
    expect(reasonsQuery.parse({ seed: "GUM" }).first).toBeUndefined();
  });
});

