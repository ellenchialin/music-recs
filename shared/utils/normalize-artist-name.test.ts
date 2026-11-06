import { describe, expect, it } from "vitest";
import { normalizeArtistName } from "./normalize-artist-name";

describe("normalizeArtistName", () => {
  it("trims and lowercases", () => {
    expect(normalizeArtistName("  Radiohead ")).toBe("radiohead");
  });

  it("collapses inner whitespace to a single space", () => {
    expect(normalizeArtistName("Sigur   Rós")).toBe("sigur rós");
    expect(normalizeArtistName("Daft\tPunk")).toBe("daft punk");
    // Full-width space (U+3000) from CJK input methods
    expect(normalizeArtistName("Sigur\u3000R\u00F3s")).toBe("sigur r\u00F3s");
  });

  it("turns full-width letters into normal ones", () => {
    expect(normalizeArtistName("ＲＡＤＷＩＭＰＳ")).toBe("radwimps");
  });

  // U+00F6 vs "o" + U+0308: identical on screen, but not ===
  it("treats the two ways of writing ö as the same", () => {
    // Typed as string so TypeScript allows comparing two different literals
    const precomposed: string = "Bj\u00F6rk";
    const combining: string = "Bjo\u0308rk";
    expect(precomposed === combining).toBe(false);
    expect(normalizeArtistName(combining)).toBe(normalizeArtistName(precomposed));
  });

  // Accents are part of the name; Last.fm decides whether Sigur Rós is Sigur Ros
  it("keeps accents and non-Latin scripts as they are", () => {
    expect(normalizeArtistName("Sigur Rós")).toBe("sigur rós");
    expect(normalizeArtistName("宇多田ヒカル")).toBe("宇多田ヒカル");
  });
});
