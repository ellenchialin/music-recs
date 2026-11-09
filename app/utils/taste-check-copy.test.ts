import { describe, expect, it } from "vitest";
import { describeOverall, describeRound } from "./taste-check-copy";

const song = (isRecommended: boolean, rating: number) => ({ isRecommended, rating });

describe("describeRound", () => {
  it("compares your ratings and says which side won", () => {
    expect(describeRound([song(true, 5), song(false, 3), song(true, 2)])).toBe(
      "You gave the songs picked for you 3.5 on average, and the random pick 3. The picks won this round.",
    );
  });

  it("says when the random picks won", () => {
    expect(describeRound([song(true, 2), song(false, 4), song(false, 5)])).toBe(
      "You gave the song picked for you 2, and the random picks 4.5 on average. The random picks won this round.",
    );
  });

  it("calls a tie a tie", () => {
    expect(describeRound([song(true, 3), song(false, 3), song(false, 3)])).toBe(
      "You gave the song picked for you 3, and the random picks 3 on average. It's a tie this round.",
    );
  });
});

describe("describeOverall", () => {
  const stats = (difference: number, ci: [number, number] | null, visitors: number) => ({ difference, ci, visitors });

  it("reports a clear win for the recommendations", () => {
    expect(describeOverall(stats(0.84, [0.3, 1.38], 12))).toBe(
      "Across 12 listeners, songs picked for them score 0.8 points higher (out of 5) than random picks.",
    );
  });

  it("reports a clear loss honestly", () => {
    expect(describeOverall(stats(-0.6, [-1.1, -0.1], 9))).toBe(
      "Across 9 listeners, songs picked for them score 0.6 points lower (out of 5) than random picks.",
    );
  });

  // Until the interval excludes zero, any difference could be chance
  it("says it's too early when the difference could be chance", () => {
    expect(describeOverall(stats(-0.02, [-4.44, 4.41], 3))).toBe(
      "No clear difference yet across 3 listeners. More ratings will tell.",
    );
    expect(describeOverall(stats(1.5, null, 1))).toBe("No clear difference yet across 1 listener. More ratings will tell.");
  });
});
