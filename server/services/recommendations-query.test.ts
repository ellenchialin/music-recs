import { describe, expect, it } from "vitest";
import { recommendationsQuery } from "./recommendations-query";

// 網址的 query string：?seed=Tame%20Impala&seed=Kokoroko
// 只有一個 seed 時 h3 給字串，兩個以上給陣列，schema 統一成陣列

describe("recommendationsQuery", () => {
  it("turns one seed into a list", () => {
    expect(recommendationsQuery.parse({ seed: "Tame Impala" })).toEqual({ seeds: ["Tame Impala"] });
  });

  it("keeps several seeds in order and trims them", () => {
    expect(recommendationsQuery.parse({ seed: [" Tame Impala ", "Kokoroko"] })).toEqual({
      seeds: ["Tame Impala", "Kokoroko"],
    });
  });

  // 種子 1–3 位，和前端一樣
  it("accepts one to three seeds", () => {
    expect(recommendationsQuery.safeParse({}).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: ["A", "B", "C", "D"] }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: ["A", "B", "C"] }).success).toBe(true);
  });

  it("rejects empty or very long names", () => {
    expect(recommendationsQuery.safeParse({ seed: "  " }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: "x".repeat(201) }).success).toBe(false);
  });
});
