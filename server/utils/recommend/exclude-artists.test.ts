import { describe, expect, it } from "vitest";
import { excludeArtists } from "./exclude-artists";
import type { Candidate } from "./types";

// 手做的候選清單：只填有差別的欄位
function candidate(name: string, mbid: string | null = null): Candidate {
  return { name, nameNorm: name.toLowerCase(), mbid, score: 1, sources: ["Radiohead"] };
}

describe("excludeArtists", () => {
  // 種子歌手常常出現在別的種子的相似清單裡：選了 Radiohead 和 Thom Yorke，不該再推薦這兩位
  it("removes artists by normalized name", () => {
    const candidates = [candidate("Thom Yorke"), candidate("Portishead")];
    const result = excludeArtists(candidates, [{ nameNorm: "thom yorke", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["Portishead"]);
  });

  // 同一位歌手換個名字出現（別名、不同語言的寫法），但 MusicBrainz ID 一樣：也要排除
  it("removes a different name with the same MBID", () => {
    const candidates = [candidate("Hikaru Utada", "b539e453"), candidate("Boa", "99dd9355")];
    const result = excludeArtists(candidates, [{ nameNorm: "宇多田ヒカル", mbid: "b539e453" }]);
    expect(result.map((c) => c.name)).toEqual(["Boa"]);
  });

  // 陷阱：很多歌手沒有 MBID（null）。兩個 null 不代表同一位歌手
  it("never treats two missing MBIDs as the same artist", () => {
    const candidates = [candidate("Utada", null), candidate("Boa", null)];
    const result = excludeArtists(candidates, [{ nameNorm: "宇多田ヒカル", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["Utada", "Boa"]);
  });

  // 排除不能打亂排序：前面算好的分數順序要保留
  it("keeps the order of the remaining candidates", () => {
    const candidates = ["A", "B", "C", "D"].map((n) => candidate(n));
    const result = excludeArtists(candidates, [{ nameNorm: "b", mbid: null }]);
    expect(result.map((c) => c.name)).toEqual(["A", "C", "D"]);
  });

  it("returns everything when nothing is excluded", () => {
    const candidates = [candidate("A"), candidate("B")];
    expect(excludeArtists(candidates, [])).toEqual(candidates);
  });
});
