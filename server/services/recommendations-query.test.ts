import { describe, expect, it } from "vitest";
import { recommendationsQuery } from "./recommendations-query";

// 網址的 query string：?seed=Tame%20Impala&seed=Kokoroko
// 只有一個 seed 時 h3 給字串，兩個以上給陣列，schema 統一成陣列

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

  // Explore from here：往下挖時，排除原本的種子和前面各層看過的歌手
  // ?seed=GUM&exclude=Tame%20Impala&exclude=Pond，和 seed 一樣：一個是字串、多個是陣列
  it("accepts artists to exclude, one or many", () => {
    expect(recommendationsQuery.parse({ seed: "GUM", exclude: "Pond" }).exclude).toEqual(["Pond"]);
    expect(recommendationsQuery.parse({ seed: "GUM", exclude: [" Pond ", "Tame Impala"] }).exclude).toEqual([
      "Pond",
      "Tame Impala",
    ]);
  });

  // 最多挖 3 層：種子 3 位 ＋ 每層 10 張 × 3 層，60 位綽綽有餘；再多就是有人亂送
  it("accepts at most 60 artists to exclude", () => {
    const names = (n: number) => Array.from({ length: n }, (_, i) => `Artist ${i}`);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: names(60) }).success).toBe(true);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: names(61) }).success).toBe(false);
    expect(recommendationsQuery.safeParse({ seed: "GUM", exclude: " " }).success).toBe(false);
  });
});
