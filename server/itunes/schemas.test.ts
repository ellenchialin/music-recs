import { describe, expect, it } from "vitest";
import noResults from "./fixtures/search-no-results.json";
import creep from "./fixtures/search-radiohead-creep.json";
import utada from "./fixtures/search-utada-first-love.json";
import { searchResponse } from "./schemas";

// Fixtures are recorded from the real API with `pnpm record:itunes`

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

  it("asks for a 600px cover instead of the 100px one", () => {
    for (const track of searchResponse.parse(creep.body)) {
      expect(track.artworkUrl).toMatch(/\/600x600bb\.jpg$/);
    }
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchResponse.parse(noResults.body)).toEqual([]);
  });

  // Hand-made: the recorded fixtures all have previews, but iTunes doesn't guarantee one
  it("turns a missing preview or cover into null", () => {
    const body = { resultCount: 1, results: [{ kind: "song", trackId: 1, trackName: "A", artistName: "B" }] };
    expect(searchResponse.parse(body)).toEqual([
      { id: 1, name: "A", artist: "B", album: null, previewUrl: null, artworkUrl: null },
    ]);
  });

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
