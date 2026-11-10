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
  const stats = (recommendedMean: number, controlMean: number, ci: [number, number] | null, visitors: number) => ({
    recommendedMean,
    controlMean,
    ci,
    visitors,
  });

  // Two averages side by side are easier to read than "1 point higher"
  it("shows both averages and calls a clear win", () => {
    expect(describeOverall(stats(4.12, 3.08, [0.5, 1.6], 20))).toBe(
      "Across 20 listeners, songs picked for them averaged 4.1 out of 5, random picks 3.1. The algorithm has taste.",
    );
  });

  it("owns up to a clear loss", () => {
    expect(describeOverall(stats(2.6, 3.4, [-1.3, -0.3], 9))).toBe(
      "Across 9 listeners, songs picked for them averaged 2.6 out of 5, random picks 3.4. Random is winning. The algorithm has some homework to do.",
    );
  });

  // Until the 95% interval excludes zero, the gap could be chance
  it("calls it too close while the difference could be chance", () => {
    expect(describeOverall(stats(4, 3.98, [-4.4, 4.4], 3))).toBe(
      "Across 3 listeners so far, songs picked for them averaged 4.0 out of 5, random picks 4.0. Too close to call. More ears needed.",
    );
  });

  it("says listener, not listeners, for one", () => {
    expect(describeOverall(stats(5, 2, null, 1))).toBe(
      "Across 1 listener so far, songs picked for them averaged 5.0 out of 5, random picks 2.0. Too close to call. More ears needed.",
    );
  });
});
