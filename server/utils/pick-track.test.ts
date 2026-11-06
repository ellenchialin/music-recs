import { describe, expect, it } from "vitest";
import creep from "../itunes/fixtures/search-radiohead-creep.json";
import utada from "../itunes/fixtures/search-utada-first-love.json";
import { searchResponse, type ItunesTrack } from "../itunes/schemas";
import { pickTrack } from "./pick-track";

// The first tests use recorded iTunes results; the rest are hand-made, one rule each
const creepResults = searchResponse.parse(creep.body);
const utadaResults = searchResponse.parse(utada.body);

function track(id: number, name: string, artist: string, previewUrl: string | null = "https://example.com/p.m4a"): ItunesTrack {
  return { id, name, artist, album: null, previewUrl, artworkUrl: null };
}

describe("pickTrack", () => {
  it("picks the exact title by the right artist", () => {
    const picked = pickTrack(utadaResults, { artist: "Hikaru Utada", title: "First Love" });
    expect(picked?.id).toBe(1445055008);
  });

  // Real data: TLC's "Creep" matches the title but not the artist, and Radiohead's original
  // isn't in the Taiwan store
  it("falls back to another version rather than a different artist's song", () => {
    const picked = pickTrack(creepResults, { artist: "Radiohead", title: "Creep" });
    expect(picked).toMatchObject({ id: 1679849823, name: "Creep (Acoustic)" });
  });

  it("ignores case and surrounding spaces", () => {
    const picked = pickTrack(creepResults, { artist: " radiohead", title: "CREEP " });
    expect(picked?.id).toBe(1679849823);
  });

  it("prefers the exact title even when a version comes first", () => {
    const tracks = [track(1, "Karma Police (Live)", "Radiohead"), track(2, "Karma Police", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Karma Police" })?.id).toBe(2);
  });

  it("skips tracks without a preview", () => {
    const tracks = [track(1, "Creep", "Radiohead", null), track(2, "Creep - Live", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep" })?.id).toBe(2);
  });

  it("does not treat a different song that starts with the title as a version", () => {
    const tracks = [track(1, "Creeping Death", "Radiohead"), track(2, "Creep-Show", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep" })).toBeNull();
  });

  // Versions only match one way: result = wanted title + suffix
  it("does not fall back to the original when the wanted title is a version", () => {
    const tracks = [track(1, "Creep", "Radiohead")];
    expect(pickTrack(tracks, { artist: "Radiohead", title: "Creep (Acoustic)" })).toBeNull();
  });

  // Real data: the Taiwan store lists her as "Hikaru Utada". No preview beats the wrong song
  it("returns null when the artist is not in the results", () => {
    expect(pickTrack(utadaResults, { artist: "宇多田ヒカル", title: "First Love" })).toBeNull();
  });
});
