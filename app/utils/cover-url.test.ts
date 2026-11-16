import { describe, expect, it } from "vitest";
import { coverUrl } from "./cover-url";

const url = "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4a/c1/cover.jpg/600x600bb.jpg";

describe("coverUrl", () => {
  it("asks iTunes for the cover at the given size and format", () => {
    expect(coverUrl(url, 300, "webp")).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4a/c1/cover.jpg/300x300bb.webp");
    expect(coverUrl(url, 1, "jpg")).toBe("https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4a/c1/cover.jpg/1x1bb.jpg");
  });

  it("only changes the size at the end, not a size-like part of the path", () => {
    const tricky = "https://is1-ssl.mzstatic.com/image/thumb/100x100bb.x/cover.jpg/600x600bb.jpg";
    expect(coverUrl(tricky, 300, "webp")).toBe("https://is1-ssl.mzstatic.com/image/thumb/100x100bb.x/cover.jpg/300x300bb.webp");
  });

  // Saved results or a future source may not follow iTunes' pattern
  it("leaves other URLs as they are", () => {
    expect(coverUrl("https://art.example/cover.jpg", 300, "webp")).toBe("https://art.example/cover.jpg");
  });
});
