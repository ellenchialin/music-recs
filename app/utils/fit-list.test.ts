import { describe, expect, it } from "vitest";
import { MIN_LIST_HEIGHT, listMaxHeight } from "./fit-list";

// A phone with the keyboard up: the visible area is the top 360px of the page
const viewport = { top: 0, height: 360 };

describe("listMaxHeight", () => {
  it("fits a list that opens upward between its bottom edge and the top of the visible area", () => {
    expect(listMaxHeight({ list: { top: 100, bottom: 242 }, viewport, opensUp: true, cap: 320 })).toBe(234);
  });

  it("fits a list that opens downward between its top edge and the bottom of the visible area", () => {
    expect(listMaxHeight({ list: { top: 128, bottom: 300 }, viewport, opensUp: false, cap: 320 })).toBe(224);
  });

  it("never grows past its own cap", () => {
    expect(listMaxHeight({ list: { top: 600, bottom: 892 }, viewport: { top: 0, height: 1000 }, opensUp: true, cap: 320 })).toBe(320);
  });

  // Scrolled page: positions are relative to the page's layout, the visible area starts lower
  it("measures from the top of the visible area, not of the page", () => {
    expect(listMaxHeight({ list: { top: 320, bottom: 442 }, viewport: { top: 300, height: 360 }, opensUp: true, cap: 320 })).toBe(134);
  });

  it("keeps at least two rows when there's hardly any room", () => {
    expect(listMaxHeight({ list: { top: 0, bottom: 12 }, viewport, opensUp: true, cap: 320 })).toBe(MIN_LIST_HEIGHT);
  });
});
