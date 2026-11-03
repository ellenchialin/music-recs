import { describe, expect, it } from "vitest";
import creep from "../itunes/fixtures/search-radiohead-creep.json";
import utada from "../itunes/fixtures/search-utada-first-love.json";
import { searchResponse, type ItunesTrack } from "../itunes/schemas";
import { pickTrack } from "./pick-track";

// 前三個測試用錄好的真實搜尋結果；後面的是手做的，各自只檢查一條規則
const creepResults = searchResponse.parse(creep.body);
const utadaResults = searchResponse.parse(utada.body);

// 手做案例用：只填有差別的欄位
function track(id: number, name: string, artist: string, previewUrl: string | null = "https://example.com/p.m4a"): ItunesTrack {
  return { id, name, artist, album: null, previewUrl, artworkUrl: null };
}

describe("pickTrack", () => {
  // 最簡單的情況：第一筆就是原版
  it("picks the exact title by the right artist", () => {
    const picked = pickTrack(utadaResults, { artist: "Hikaru Utada", title: "First Love" });
    expect(picked?.id).toBe(1445055008);
  });

  // 結果裡有 TLC 的〈Creep〉：歌名完全相同，但歌手不對，不能選
  // Radiohead 的原版不在台灣商店，只好退而求其次，選 Acoustic 版
  it("falls back to another version rather than a different artist's song", () => {
    const picked = pickTrack(creepResults, { artist: "Radiohead", title: "Creep" });
    expect(picked).toMatchObject({ id: 1679849823, name: "Creep (Acoustic)" });
  });

  // Last.fm 和 iTunes 的大小寫、空白不一定一致
  it("ignores case and surrounding spaces", () => {
    const picked = pickTrack(creepResults, { artist: " radiohead", title: "CREEP " });
    expect(picked?.id).toBe(1679849823);
  });

  // 版本排在原版前面時，還是要選原版
  it("prefers the exact title even when a version comes first", () => {
    const tracks = [track(1, "Karma Police (Live)", "Radiohead"), track(2, "Karma Police", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Karma Police" })?.id).toBe(2);
  });

  // 卡片的重點是試聽：沒有試聽的原版，不如有試聽的其他版本
  it("skips tracks without a preview", () => {
    const tracks = [track(1, "Creep", "Radiohead", null), track(2, "Creep - Live", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep" })?.id).toBe(2);
  });

  // 「Creep」開頭不代表是 Creep 的版本：後面要接空白加括號或破折號
  it("does not treat a different song that starts with the title as a version", () => {
    const tracks = [track(1, "Creeping Death", "Radiohead"), track(2, "Creep-Show", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep" })).toBeNull();
  });

  // 反過來：Last.fm 的歌名帶版本、iTunes 只有原版。「版本」只往一個方向比對（結果 = 要的歌名 + 版本說明），
  // 所以原版不算 Acoustic 版的版本，回 null
  it("does not fall back to the original when the wanted title is a version", () => {
    const tracks = [track(1, "Creep", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep (Acoustic)" })).toBeNull();
  });

  // 台灣商店把宇多田ヒカル 寫成 Hikaru Utada：比不到就回 null，寧可不顯示試聽，也不要放錯歌
  // （別名怎麼對應，等推薦演算法時處理）
  it("returns null when the artist is not in the results", () => {
    expect(pickTrack(utadaResults, { artist: "宇多田ヒカル", title: "First Love" })).toBeNull();
  });
});
