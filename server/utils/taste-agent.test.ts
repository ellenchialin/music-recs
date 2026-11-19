import { describe, expect, it } from "vitest";
import { MAX_DESCRIPTION_LENGTH } from "../../shared/types/describe";
import { TASTE_TOOLS, checkSuggestion, describeRequest, describeStep, seenNames } from "./taste-agent";

describe("TASTE_TOOLS", () => {
  it("offers four read-only lookups and one way to finish", () => {
    expect(TASTE_TOOLS.map((t) => t.name)).toEqual([
      "search_artists",
      "get_artist",
      "get_similar_artists",
      "get_top_artists_for_tag",
      "suggest_artists",
    ]);
  });
});

describe("describeStep", () => {
  // Shown on the page as each step runs, so they read as plain sentences
  it("labels each lookup with what it's about", () => {
    expect(describeStep("search_artists", { query: "lazy jazz" })).toBe('Searching for "lazy jazz"');
    expect(describeStep("get_artist", { name: "Tame Impala" })).toBe("Looking up Tame Impala");
    expect(describeStep("get_similar_artists", { name: "Tame Impala" })).toBe("Finding artists like Tame Impala");
    expect(describeStep("get_top_artists_for_tag", { tag: "jazz" })).toBe('Finding top "jazz" artists');
    expect(describeStep("suggest_artists", {})).toBe("Choosing artists");
  });
});

describe("seenNames", () => {
  it("keeps every artist a lookup returned, by normalized name", () => {
    const seen = seenNames();
    seen.add(["Tame Impala", "Pond"]);
    seen.add(["pond "]);

    expect(seen.find("TAME IMPALA")).toBe("Tame Impala");
    expect(seen.find("Pond")).toBe("Pond");
    expect(seen.find("MGMT")).toBeNull();
  });
});

describe("checkSuggestion", () => {
  const seen = seenNames();
  seen.add(["Pond", "Khruangbin", "Temples", "GUM"]);

  it("accepts one to three looked-up artists, in their Last.fm spelling", () => {
    expect(
      checkSuggestion({ artists: [{ name: "pond", why: " Same psych sound, faster. " }, { name: "Khruangbin", why: "Steady groove." }] }, seen),
    ).toEqual({ ok: true, artists: [{ name: "Pond", why: "Same psych sound, faster." }, { name: "Khruangbin", why: "Steady groove." }] });
  });

  // The model is told so it can try again with names it actually looked up
  it("refuses names no lookup returned, and says which", () => {
    expect(checkSuggestion({ artists: [{ name: "Pond", why: "Psych." }, { name: "Made Up Band", why: "Great." }] }, seen)).toEqual({
      ok: false,
      error: "Only suggest artists your lookups returned. Not found: Made Up Band",
    });
  });

  it("refuses an empty list, more than three, and repeats", () => {
    expect(checkSuggestion({ artists: [] }, seen).ok).toBe(false);
    expect(checkSuggestion({ artists: ["Pond", "Khruangbin", "Temples", "GUM"].map((name) => ({ name, why: "x" })) }, seen).ok).toBe(false);
    expect(checkSuggestion({ artists: [{ name: "Pond", why: "x" }, { name: "pond", why: "y" }] }, seen).ok).toBe(false);
  });

  it("refuses a missing or too long why", () => {
    expect(checkSuggestion({ artists: [{ name: "Pond", why: "" }] }, seen).ok).toBe(false);
    expect(checkSuggestion({ artists: [{ name: "Pond", why: "x".repeat(81) }] }, seen).ok).toBe(false);
  });

  it("refuses input that isn't the expected shape", () => {
    expect(checkSuggestion({ artists: "Pond" }, seen).ok).toBe(false);
    expect(checkSuggestion(null, seen).ok).toBe(false);
  });
});

describe("MAX_DESCRIPTION_LENGTH", () => {
  it("leaves room for a sentence or two, not an essay", () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(200);
  });
});

describe("describeRequest", () => {
  it("takes a trimmed description", () => {
    expect(describeRequest.parse({ description: "  Lazy jazz for a rainy afternoon " })).toEqual({ description: "Lazy jazz for a rainy afternoon" });
  });

  it("refuses an empty or too long description", () => {
    expect(describeRequest.safeParse({ description: "   " }).success).toBe(false);
    expect(describeRequest.safeParse({ description: "x".repeat(MAX_DESCRIPTION_LENGTH + 1) }).success).toBe(false);
    expect(describeRequest.safeParse({}).success).toBe(false);
  });
});

