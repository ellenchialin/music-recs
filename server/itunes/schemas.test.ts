import { describe, expect, it } from "vitest";
import noResults from "./fixtures/search-no-results.json";
import creep from "./fixtures/search-radiohead-creep.json";
import utada from "./fixtures/search-utada-first-love.json";
import { searchResponse } from "./schemas";

// fixture 是 pnpm record:itunes 從真的 API 錄下來的；body 是 iTunes 原封不動的回應

describe("searchResponse", () => {
  it("keeps only the fields we use", () => {
    const [first] = searchResponse.parse(utada.body);
    expect(first).toEqual({
      id: 1445055008,
      name: "First Love",
      artist: "Hikaru Utada",
      album: "First Love - EP",
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/8a/ef/99/8aef99aa-02e7-a0ed-62c2-52b8b7e0c438/mzaf_18106053477060712364.plus.aac.p.m4a",
      artworkUrl:
        "https://is1-ssl.mzstatic.com/image/thumb/Music128/v4/d1/a6/81/d1a681b9-aa68-6148-5a50-69fd4c95cc37/00602567241966.rgb.jpg/600x600bb.jpg",
    });
  });

  // iTunes 只給 30/60/100px 的封面網址，但網址裡的尺寸可以改；卡片要 600px 才不糊
  it("asks for a 600px cover instead of the 100px one", () => {
    for (const track of searchResponse.parse(creep.body)) {
      expect(track.artworkUrl).toMatch(/\/600x600bb\.jpg$/);
    }
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchResponse.parse(noResults.body)).toEqual([]);
  });

  // 以下是手做的案例：錄到的 fixture 剛好都有試聽，但 iTunes 不保證每首都有
  it("turns a missing preview or cover into null", () => {
    const body = { resultCount: 1, results: [{ kind: "song", trackId: 1, trackName: "A", artistName: "B" }] };
    expect(searchResponse.parse(body)).toEqual([
      { id: 1, name: "A", artist: "B", album: null, previewUrl: null, artworkUrl: null },
    ]);
  });

  // entity=song 理論上只回歌曲，但多一道過濾：MV（music-video）沒有可以放進卡片的音訊試聽
  it("drops results that are not songs", () => {
    const body = {
      resultCount: 2,
      results: [
        { kind: "music-video", trackId: 1, trackName: "A", artistName: "B" },
        { kind: "song", trackId: 2, trackName: "C", artistName: "D" },
      ],
    };
    expect(searchResponse.parse(body).map((t) => t.id)).toEqual([2]);
  });
});
