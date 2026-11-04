import { describe, expect, it } from "vitest";
import search from "../lastfm/fixtures/search-radiohead.json";
import { artistSearchResponse, type ArtistSearchResult } from "../lastfm/schemas";
import { toArtistSuggestions } from "./artist-suggestions";

const result = (name: string, listeners: number): ArtistSearchResult => ({ name, mbid: null, listeners });

describe("toArtistSuggestions", () => {
  // 真實資料：搜尋 radiohead 的第二筆是拼錯的分身「radıohead」（117 位聽眾），不該出現在自動完成
  it("drops lookalikes with few listeners", () => {
    const names = toArtistSuggestions(artistSearchResponse.parse(search.body)).map((s) => s.name);
    expect(names[0]).toBe("Radiohead");
    expect(names).not.toContain("radıohead");
  });

  it("keeps the name and listener count, in Last.fm's order", () => {
    expect(toArtistSuggestions([result("Tame Impala", 3_000_000), result("Tame Impala Tribute", 5_000)])).toEqual([
      { name: "Tame Impala", listeners: 3_000_000 },
      { name: "Tame Impala Tribute", listeners: 5_000 },
    ]);
  });

  // 同一位歌手只差大小寫時只留第一個，自動完成不重複
  it("keeps one entry per normalized name", () => {
    const names = toArtistSuggestions([result("Kokoroko", 200_000), result("KOKOROKO", 3_000)]).map((s) => s.name);
    expect(names).toEqual(["Kokoroko"]);
  });

  // 真實資料：搜尋 tame impala 的第二筆是「Tame \u0130mpala」（土耳其文有點的大寫 I），聽眾 1965 人，過得了聽眾門檻。
  // 去掉重音、把各種 i 當成一樣來比，就認得出是分身；留聽眾多的那位（分身排在前面時也一樣），位置照第一次出現的
  it("drops lookalikes that differ only by accents or dotted letters", () => {
    const names = toArtistSuggestions([
      result("Tame Impala", 4_697_353),
      result("Tame \u0130mpala", 1_965),
      result("rad\u0131ohead", 2_000),
      result("Radiohead", 8_500_000),
    ]).map((s) => s.name);
    expect(names).toEqual(["Tame Impala", "Radiohead"]);
  });

  it("returns at most the limit", () => {
    const many = Array.from({ length: 20 }, (_, i) => result(`Artist ${i}`, 10_000));
    expect(toArtistSuggestions(many, 8)).toHaveLength(8);
  });
});
