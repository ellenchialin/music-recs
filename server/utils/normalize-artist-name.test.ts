import { describe, expect, it } from "vitest";
import { normalizeArtistName } from "./normalize-artist-name";

describe("normalizeArtistName", () => {
  // 使用者輸入時常不小心多打空白、大小寫不一
  it("trims and lowercases", () => {
    expect(normalizeArtistName("  Radiohead ")).toBe("radiohead");
  });

  // 名字中間連打好幾個空白（或 Tab）也算同一位
  it("collapses inner whitespace to a single space", () => {
    expect(normalizeArtistName("Sigur   Rós")).toBe("sigur rós");
    expect(normalizeArtistName("Daft\tPunk")).toBe("daft punk");
    // 中文輸入法的全形空白（U+3000）
    expect(normalizeArtistName("Sigur\u3000R\u00F3s")).toBe("sigur r\u00F3s");
  });

  // 中文輸入法切到全形時打出來的英文字母
  it("turns full-width letters into normal ones", () => {
    expect(normalizeArtistName("ＲＡＤＷＩＭＰＳ")).toBe("radwimps");
  });

  // 「ö」在電腦裡有兩種存法：一個字元 U+00F6，或「o」加上兩點 U+0308。
  // 畫面上一模一樣，但 === 比較是 false
  it("treats the two ways of writing ö as the same", () => {
    // 標成 string：不然 TypeScript 把兩個字面值當成不同型別，不讓我們用 === 比較
    const precomposed: string = "Bj\u00F6rk";
    const combining: string = "Bjo\u0308rk";
    expect(precomposed === combining).toBe(false);
    expect(normalizeArtistName(combining)).toBe(normalizeArtistName(precomposed));
  });

  // 重音符號是名字的一部分，不能拿掉：Sigur Rós 和 Sigur Ros 交給 Last.fm 判斷
  it("keeps accents and non-Latin scripts as they are", () => {
    expect(normalizeArtistName("Sigur Rós")).toBe("sigur rós");
    expect(normalizeArtistName("宇多田ヒカル")).toBe("宇多田ヒカル");
  });
});
