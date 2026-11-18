import { describe, expect, it } from "vitest";
import { createReasonsParser } from "./reasons-stream-parser";

const answer = JSON.stringify({
  reasons: [
    { artist: "Pond", reason: "Woozy psych pop with a {dreamy} swirl" },
    { artist: "GUM", reason: "Says \"hi\" and \\ then [jangles]" },
    { artist: "MGMT", reason: null },
  ],
});

// Feeds the answer in pieces of `size` characters and collects what comes out after each piece
function feed(text: string, size: number) {
  const parser = createReasonsParser();
  const out: unknown[][] = [];
  for (let i = 0; i < text.length; i += size) out.push(parser.push(text.slice(i, i + size)));
  return out;
}

describe("createReasonsParser", () => {
  it("hands out each entry once it is complete, in order", () => {
    expect(feed(answer, 7).flat()).toEqual([
      { artist: "Pond", reason: "Woozy psych pop with a {dreamy} swirl" },
      { artist: "GUM", reason: 'Says "hi" and \\ then [jangles]' },
      { artist: "MGMT", reason: null },
    ]);
  });

  it("works whether the text arrives a character at a time or all at once", () => {
    expect(feed(answer, 1).flat()).toEqual(feed(answer, answer.length).flat());
  });

  // Braces and quotes inside a reason must not end the entry early
  it("waits for the closing brace of an entry, not one inside its text", () => {
    const parser = createReasonsParser();
    expect(parser.push('{"reasons":[{"artist":"Pond","reason":"a } b')).toEqual([]);
    expect(parser.push(' c"}')).toEqual([{ artist: "Pond", reason: "a } b c" }]);
  });

  it("hands out nothing for an answer cut off mid-entry", () => {
    expect(createReasonsParser().push('{"reasons":[{"artist":"Pond","reas')).toEqual([]);
  });
});
