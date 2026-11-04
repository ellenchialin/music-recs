import { describe, expect, it } from "vitest";
import type { RecommendationsResult } from "~~/shared/types/recommendations";
import { MAX_EXPLORE_DEPTH, backTo, canExplore, excludedFor, exploreFrom, type Trail } from "./explore-trail";

const result = (...artists: string[]): RecommendationsResult => ({
  algoVersion: "v2",
  seeds: [],
  recommendations: artists.map((artist) => ({
    artist,
    score: 0.1,
    sources: [],
    track: null,
    preview: { status: "unavailable" },
  })),
});

// 第一層：使用者選的種子推出來的；artist 是 null
const root: Trail = [{ artist: null, result: result("Pond", "GUM", "Khruangbin"), index: 0 }];

describe("explore trail", () => {
  it("allows exploring three levels deep", () => {
    expect(MAX_EXPLORE_DEPTH).toBe(3);
    let trail = root;
    for (const artist of ["Pond", "GUM", "Temples"]) {
      expect(canExplore(trail)).toBe(true);
      trail = exploreFrom(trail, artist, result(`${artist} friend`));
    }
    expect(trail).toHaveLength(4);
    expect(canExplore(trail)).toBe(false);
  });

  // 往下挖：新的一層從第一張開始，前面各層記住當時看到第幾張；不改原本的陣列
  it("adds a level without changing the earlier ones", () => {
    const viewing: Trail = [{ ...root[0]!, index: 2 }];
    const trail = exploreFrom(viewing, "Khruangbin", result("Bonobo", "Thievery Corporation"));
    expect(trail.map((l) => [l.artist, l.index])).toEqual([
      [null, 2],
      ["Khruangbin", 0],
    ]);
    expect(viewing).toHaveLength(1);
  });

  // 排除名單：原本的種子 ＋ 每一層顯示過的唱片（往下挖的那位本來就在上一層的唱片裡），不重複
  it("excludes the seeds and every record shown so far", () => {
    const trail = exploreFrom(root, "Pond", result("Temples", "GUM", "Mink Mussel Creek"));
    expect(excludedFor(trail, ["Tame Impala", "Kokoroko"])).toEqual([
      "Tame Impala",
      "Kokoroko",
      "Pond",
      "GUM",
      "Khruangbin",
      "Temples",
      "Mink Mussel Creek",
    ]);
  });

  // 點路徑回到某一層：後面的層丟掉，那一層看到第幾張保留
  it("goes back to a level and keeps where the visitor was", () => {
    const viewing: Trail = [{ ...root[0]!, index: 1 }];
    const deep = exploreFrom(exploreFrom(viewing, "GUM", result("A")), "A", result("B"));
    const back = backTo(deep, 0);
    expect(back).toHaveLength(1);
    expect(back[0]!.index).toBe(1);
  });
});
