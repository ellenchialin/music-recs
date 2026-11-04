import { describe, expect, it } from "vitest";
import { homeLocation, parseRecommendationsQuery, recommendationsLocation, seedsLabel } from "./recommendations-route";

// /recommendations 的網址就是推薦結果的唯一來源：種子和往下挖的路徑都在 query 裡，
// 所以上一頁、重新整理、分享連結都看到同一個畫面

describe("parseRecommendationsQuery", () => {
  // Vue Router 的 query：一個值是字串、多個是陣列
  it("reads one or many seeds and the explore path", () => {
    expect(parseRecommendationsQuery({ seed: "Tame Impala" })).toEqual({ seeds: ["Tame Impala"], explore: [] });
    expect(parseRecommendationsQuery({ seed: ["Tame Impala", "Kokoroko"], explore: ["Pond", "GUM"] })).toEqual({
      seeds: ["Tame Impala", "Kokoroko"],
      explore: ["Pond", "GUM"],
    });
  });

  // 網址可以手改：去掉空白、空字串和重複的種子
  it("cleans up hand-edited seeds", () => {
    expect(parseRecommendationsQuery({ seed: [" Tame Impala ", "", "tame impala", "Kokoroko"] })?.seeds).toEqual([
      "Tame Impala",
      "Kokoroko",
    ]);
  });

  // 沒有種子：沒有東西可以推薦（頁面請使用者回首頁）
  it("returns null without any seed", () => {
    expect(parseRecommendationsQuery({})).toBeNull();
    expect(parseRecommendationsQuery({ seed: "  " })).toBeNull();
  });

  // 種子最多 3 位、往下挖最多 3 層：多的忽略，不要整頁壞掉
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

  // 麵包屑的 Home：帶著種子回首頁，輸入框裡就是這組種子，可以接著改
  it("builds the home location with the seeds", () => {
    expect(homeLocation(["Tame Impala", "Kokoroko"])).toEqual({ path: "/", query: { seed: ["Tame Impala", "Kokoroko"] } });
  });

  it("labels the seeds for the breadcrumb", () => {
    expect(seedsLabel(["Tame Impala"])).toBe("Tame Impala");
    expect(seedsLabel(["Tame Impala", "Kokoroko", "Pond"])).toBe("Tame Impala + Kokoroko + Pond");
  });
});
