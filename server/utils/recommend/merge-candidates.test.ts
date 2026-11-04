import { describe, expect, it } from "vitest";
import { RANK_K, mergeCandidates } from "./merge-candidates";
import type { SeedSimilarity } from "./types";

// 手做的種子：similar 只給名字和 match，其他欄位自動補
function seed(name: string, similar: [string, number][], weight = 1): SeedSimilarity {
  return {
    seed: name,
    seedMbid: null,
    weight,
    similar: similar.map(([n, match]) => ({ name: n, nameNorm: n.toLowerCase(), mbid: null, match })),
  };
}

// v2 的分數只看名次：在一位種子的清單裡排第 rank 名，得 weight / (RANK_K + rank)
const rankScore = (rank: number, weight = 1) => Math.round((weight / (RANK_K + rank)) * 1e6) / 1e6;

describe("mergeCandidates", () => {
  // 名次依 match 由高到低決定，不依輸入的順序
  it("ranks a single seed's list by match, best first", () => {
    const result = mergeCandidates([seed("Radiohead", [["Portishead", 0.4], ["Thom Yorke", 1]])]);
    expect(result).toEqual([
      { name: "Thom Yorke", nameNorm: "thom yorke", mbid: null, score: rankScore(1), sources: ["Radiohead"] },
      { name: "Portishead", nameNorm: "portishead", mbid: null, score: rankScore(2), sources: ["Radiohead"] },
    ]);
  });

  // v1 的問題：一位種子的清單前段分數很密（0.99、0.98、0.97），就會佔掉大部分名額
  // v2 只看名次，每位種子的第 1 名分數一樣、第 2 名一樣……結果是輪流排
  it("gives every seed a fair share of the top spots", () => {
    const result = mergeCandidates([
      seed("Kokoroko", [["A1", 0.99], ["A2", 0.98], ["A3", 0.97]]),
      seed("Tame Impala", [["B1", 0.5], ["B2", 0.3]]),
    ]);
    expect(result.map((c) => c.name)).toEqual(["A1", "B1", "A2", "B2", "A3"]);
  });

  // SPEC：跟越多個種子相似，分數越高。兩位種子都排第 2 的 Khruangbin，贏過只有一位種子的第 1 名
  it("ranks an artist shared by several seeds above any single seed's best", () => {
    const result = mergeCandidates([
      seed("Tame Impala", [["Pond", 0.9], ["Khruangbin", 0.5]]),
      seed("Kokoroko", [["Ezra Collective", 0.8], ["Khruangbin", 0.4]]),
    ]);
    expect(result[0]).toMatchObject({ name: "Khruangbin", score: rankScore(2) * 2 });
  });

  // 推薦理由沒做時，卡片顯示「和 Tame Impala、Kokoroko 相似」
  it("lists every seed the artist came from, in seed order", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Khruangbin", 0.5]]), seed("Kokoroko", [["Khruangbin", 0.4]])]);
    expect(result[0]?.sources).toEqual(["Tame Impala", "Kokoroko"]);
  });

  // 之後「喜歡」加進來的種子權重比較低：分數乘上 weight
  it("multiplies each seed's contribution by its weight", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Pond", 0.8]], 0.5)]);
    expect(result[0]?.score).toBe(rankScore(1, 0.5));
  });

  // 分數一樣時依名字排：同樣的種子每次都要得到同樣的順序（盲聽測驗要能重現）
  it("breaks ties by name so the order is always the same", () => {
    const result = mergeCandidates([seed("Tame Impala", [["Pond", 0.9]]), seed("Kokoroko", [["Ezra Collective", 0.8]])]);
    expect(result.map((c) => c.name)).toEqual(["Ezra Collective", "Pond"]);
  });

  // 1/6 這種分數有無限位小數；四捨五入到 6 位，只差在浮點數誤差的分數才會被當成一樣
  it("rounds scores to six decimals", () => {
    const [first] = mergeCandidates([seed("Tame Impala", [["Pond", 0.9]])]);
    expect(String(first?.score).split(".")[1]?.length).toBeLessThanOrEqual(6);
  });

  it("returns an empty list for no seeds", () => {
    expect(mergeCandidates([])).toEqual([]);
  });
});
