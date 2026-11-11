import { describe, expect, it } from "vitest";
import { mergeSuggestions, startsAWord, withoutLastWord } from "./suggestion-match";

describe("startsAWord", () => {
  it("matches what's typed at the start of the name", () => {
    expect(startsAWord("Radiohead", "radioh")).toBe(true);
  });

  // A half-typed last word is the whole point of autocomplete
  it("matches across words with the last one half typed", () => {
    expect(startsAWord("Hiatus Kaiyote", "hiatus kai")).toBe(true);
  });

  it("matches at the start of a later word", () => {
    expect(startsAWord("Tame Impala", "impala")).toBe(true);
  });

  it("doesn't match inside a word", () => {
    expect(startsAWord("Radiohead", "head")).toBe(false);
  });

  it("ignores case, spacing and full-width letters", () => {
    expect(startsAWord("Beach House", "  BEACH   ho")).toBe(true);
    expect(startsAWord("Radiohead", "Ｒadio")).toBe(true);
  });
});

describe("withoutLastWord", () => {
  it("drops a half-typed last word", () => {
    expect(withoutLastWord("hiatus kai")).toBe("hiatus");
    expect(withoutLastWord("the national pa ")).toBe("the national");
  });

  it("is null for a single word", () => {
    expect(withoutLastWord("radioh")).toBeNull();
  });
});

describe("mergeSuggestions", () => {
  const s = (name: string, listeners: number | null = null) => ({ name, listeners });

  it("keeps the first list's order and appends what the second adds", () => {
    expect(mergeSuggestions([s("Radiohead")], [s("Radish", 10), s("radiohead ", 9_000_000)], 8)).toEqual([
      s("Radiohead", 9_000_000),
      s("Radish", 10),
    ]);
  });

  it("stops at the limit", () => {
    expect(mergeSuggestions([s("A"), s("B")], [s("C")], 2).map((x) => x.name)).toEqual(["A", "B"]);
  });
});
