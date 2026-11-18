import { describe, expect, it } from "vitest";
import { reasonStateFor, type LevelReasons } from "./reason-state";

const level = (status: LevelReasons["status"], byArtist: LevelReasons["byArtist"] = {}): LevelReasons => ({ status, byArtist });

describe("reasonStateFor", () => {
  it("shows a reason that has arrived, whatever happened after", () => {
    for (const status of ["streaming", "done", "failed", "timeout", "limit", "off"] as const) {
      expect(reasonStateFor(level(status, { Pond: "Woozy psych pop." }), "Pond")).toEqual({ kind: "ai", text: "Woozy psych pop." });
    }
  });

  // The model chose not to write one: that's an answer, not an error
  it("falls back to where the record came from when the model had nothing to say", () => {
    expect(reasonStateFor(level("streaming", { Pond: null }), "Pond")).toEqual({ kind: "fallback" });
  });

  it("is still being written while the stream is open, or before it starts", () => {
    expect(reasonStateFor(level("streaming"), "Pond")).toEqual({ kind: "pending" });
    expect(reasonStateFor(undefined, "Pond")).toEqual({ kind: "pending" });
  });

  it("falls back quietly when reasons are off or the stream finished without it", () => {
    expect(reasonStateFor(level("off"), "Pond")).toEqual({ kind: "fallback" });
    expect(reasonStateFor(level("done"), "Pond")).toEqual({ kind: "fallback" });
  });

  it("falls back, and says why, once the day's AI calls are used up", () => {
    expect(reasonStateFor(level("limit"), "Pond")).toEqual({ kind: "fallback", note: "limit" });
  });

  it("offers a retry for records left without a reason when the stream failed or took too long", () => {
    expect(reasonStateFor(level("failed"), "Pond")).toEqual({ kind: "failed", why: "failed" });
    expect(reasonStateFor(level("timeout"), "Pond")).toEqual({ kind: "failed", why: "timeout" });
  });
});
