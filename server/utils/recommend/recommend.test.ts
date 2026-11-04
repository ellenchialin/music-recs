import { describe, expect, it } from "vitest";
import similar from "../../lastfm/fixtures/similar-radiohead.json";
import { similarArtistsResponse } from "../../lastfm/schemas";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";
import { ALGO_VERSION, recommend } from "./recommend";
import type { SeedSimilarity } from "./types";

// 種子用錄好的真實相似清單：Radiohead 的前 10 位相似歌手
const radiohead: SeedSimilarity = {
  seed: "Radiohead",
  seedMbid: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  weight: 1,
  similar: similarArtistsResponse
    .parse(similar.body)
    .map((a) => ({ name: a.name, nameNorm: normalizeArtistName(a.name), mbid: a.mbid, match: a.match })),
};

// 手做的種子：similar 只給名字和 match
function seed(name: string, list: [string, number][], seedMbid: string | null = null): SeedSimilarity {
  return {
    seed: name,
    seedMbid,
    weight: 1,
    similar: list.map(([n, match]) => ({ name: n, nameNorm: normalizeArtistName(n), mbid: null, match })),
  };
}

describe("recommend", () => {
  // 每次結果都標上演算法版本，盲聽測驗的評分才知道是哪一版的推薦
  it("labels the result with the algorithm version", () => {
    expect(ALGO_VERSION).toBe("v2");
    expect(recommend({ seeds: [radiohead] }).algoVersion).toBe(ALGO_VERSION);
  });

  // 真實資料：Radiohead 的相似清單第一名是 Thom Yorke
  it("returns the best-scored similar artists up to the limit", () => {
    const { artists } = recommend({ seeds: [radiohead], limit: 3 });
    expect(artists.map((a) => a.name)).toEqual(
      radiohead.similar.slice(0, 3).map((a) => a.name),
    );
  });

  it("returns ten artists by default", () => {
    const many = seed("A", Array.from({ length: 20 }, (_, i) => [`Artist ${i}`, 1 - i / 100] as [string, number]));
    expect(recommend({ seeds: [many] }).artists).toHaveLength(10);
  });

  // 選了 Radiohead 和 Thom Yorke：兩位互相出現在對方的相似清單裡，都不該被推薦
  it("never recommends a seed", () => {
    const thom = seed("Thom Yorke", [["Radiohead", 1], ["Atoms for Peace", 0.9]]);
    const { artists } = recommend({ seeds: [radiohead, thom] });
    const names = artists.map((a) => a.name);
    expect(names).not.toContain("Radiohead");
    expect(names).not.toContain("Thom Yorke");
    expect(names).toContain("Atoms for Peace");
  });

  // 種子換個名字出現在相似清單，但 MBID 一樣：也是種子本身
  it("never recommends a seed under another name with the same MBID", () => {
    const utada = seed("宇多田ヒカル", [["Boa", 0.3]], "b539e453");
    const other = seed("浜崎あゆみ", [["Hikaru Utada", 0.9], ["Boa", 0.2]]);
    other.similar[0]!.mbid = "b539e453";
    const { artists } = recommend({ seeds: [utada, other] });
    expect(artists.map((a) => a.name)).toEqual(["Boa"]);
  });

  it("leaves out artists the visitor disliked", () => {
    const { artists } = recommend({
      seeds: [radiohead],
      disliked: [{ nameNorm: "thom yorke", mbid: null }],
      limit: 3,
    });
    expect(artists.map((a) => a.name)).not.toContain("Thom Yorke");
    expect(artists).toHaveLength(3);
  });

  // 排除之後才取前 10：不能先取 10 再排除，那樣會不足 10 位
  it("fills the list after removing excluded artists", () => {
    const list = seed("A", [["B", 0.9], ["C", 0.8], ["D", 0.7]]);
    const { artists } = recommend({ seeds: [list], disliked: [{ nameNorm: "b", mbid: null }], limit: 2 });
    expect(artists.map((a) => a.name)).toEqual(["C", "D"]);
  });

  it("returns fewer than the limit when there are not enough candidates", () => {
    expect(recommend({ seeds: [seed("A", [["B", 0.5]])] }).artists).toHaveLength(1);
  });
});
