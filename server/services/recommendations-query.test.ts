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

  // SPEC：3–5 位種子。API 接受 1–5 位，方便測試；「至少 3 位」由前端要求
  it("accepts one to five seeds", () => {
    expect(recommendationsQuery.safeParse({}).success).toBe(false);
    const six = ["A", "B", "C", "D", "E", "F"];
    expect(recommendationsQuery.safeParse({ seed: six }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: six.slice(0, 5) }).success).toBe(true);
  });

  it("rejects empty or very long names", () => {
    expect(recommendationsQuery.safeParse({ seed: "  " }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: "x".repeat(201) }).success).toBe(false);
  });
});
