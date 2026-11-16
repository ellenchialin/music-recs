import { describe, expect, it } from "vitest";
import { lookalikeKey } from "./lookalike-key";

describe("lookalikeKey", () => {
  it("strips accents", () => {
    expect(lookalikeKey("Sigur Rós")).toBe(lookalikeKey("Sigur Ros"));
    expect(lookalikeKey("Beyoncé")).toBe("beyonce");
  });

  it("treats every kind of i as the same", () => {
    expect(lookalikeKey("Altın Gün")).toBe("altin gun");
    expect(lookalikeKey("Tame İmpala")).toBe("tame impala");
  });

  it("lowercases, trims and collapses spaces", () => {
    expect(lookalikeKey("  Daft\tPunk ")).toBe("daft punk");
  });

  it("leaves CJK names alone", () => {
    expect(lookalikeKey("宇多田ヒカル")).toBe("宇多田ヒカル");
  });
});
