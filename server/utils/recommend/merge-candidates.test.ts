import { describe, expect, it } from "vitest";
import { mergeCandidates } from "./merge-candidates";
import type { SeedSimilarity } from "./types";

// 手做的種子：similar 只給名字和 match，其他欄位自動補
function seed(name: string, similar: [string, number][], weight = 1): SeedSimilarity {
  return {
    seed: name,
    weight,
    similar: similar.map(([n, match]) => ({ name: n, nameNorm: n.toLowerCase(), mbid: null, match })),
  };
}

describe("mergeCandidates", () => {
  // 只有一位種子：分數就是 match，由高到低
  it("scores a single seed's list by match, best first", () => {
    const result = mergeCandidates([seed("Radiohead", [["Portishead", 0.4], ["Thom Yorke", 1]])]);
    expect(result).toEqual([
      { name: "Thom Yorke", nameNorm: "thom yorke", mbid: null, score: 1, sources: ["Radiohead"] },
      { name: "Portishead", nameNorm: "portishead", mbid: null, score: 0.4, sources: ["Radiohead"] },
    ]);
  });

  // SPEC：跟越多個種子相似，分數越高。兩位種子都推 Muse（0.5 + 0.4），要贏過只有一位推的 Blur（0.8）
  it("adds up the scores of an artist similar to several seeds", () => {
    const result = mergeCandidates([
      seed("Radiohead", [["Blur", 0.8], ["Muse", 0.5]]),
      seed("Coldplay", [["Muse", 0.4]]),
    ]);
    expect(result.map((c) => [c.name, c.score])).toEqual([
      ["Muse", 0.9],
      ["Blur", 0.8],
    ]);
  });

  // 推薦理由沒做時，卡片顯示「和 Radiohead、Coldplay 相似」
  it("lists every seed the artist came from, in seed order", () => {
    const result = mergeCandidates([seed("Radiohead", [["Muse", 0.5]]), seed("Coldplay", [["Muse", 0.4]])]);
    expect(result[0]?.sources).toEqual(["Radiohead", "Coldplay"]);
  });

  // 之後「喜歡」加進來的種子權重比較低：分數是 weight × match
  it("multiplies each match by its seed's weight", () => {
    const result = mergeCandidates([seed("Radiohead", [["Muse", 0.8]], 0.5)]);
    expect(result[0]?.score).toBe(0.4);
  });

  // 分數一樣時依名字排：同樣的種子每次都要得到同樣的順序（盲聽測驗要能重現）
  it("breaks ties by name so the order is always the same", () => {
    const result = mergeCandidates([seed("Radiohead", [["Muse", 0.5], ["Blur", 0.5]])]);
    expect(result.map((c) => c.name)).toEqual(["Blur", "Muse"]);
  });

  // 浮點數：0.1 + 0.2 是 0.30000000000000004，不是 0.3。
  // 不處理的話，Zed 會因為誤差排在 Abe 前面，而不是照「分數一樣時依名字」的規則
  it("treats sums that differ only by floating-point error as a tie", () => {
    const result = mergeCandidates([
      seed("Radiohead", [["Zed", 0.1]]),
      seed("Coldplay", [["Zed", 0.2], ["Abe", 0.3]]),
    ]);
    expect(result.map((c) => [c.name, c.score])).toEqual([
      ["Abe", 0.3],
      ["Zed", 0.3],
    ]);
  });

  it("returns an empty list for no seeds", () => {
    expect(mergeCandidates([])).toEqual([]);
  });
});
