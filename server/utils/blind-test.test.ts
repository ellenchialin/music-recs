import { describe, expect, it } from "vitest";
import { computeStats, pickRound, pickTopTag, type RatedItem } from "./blind-test";

// A random() that returns these values in order, so picks are predictable
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

const song = (artist: string) => ({ artist, title: `${artist} Hit`, previewUrl: `https://a.mzstatic.com/${artist}.m4a` });

describe("pickTopTag", () => {
  it("picks the tag shared by the most seeds", () => {
    expect(pickTopTag([["psychedelic rock", "indie"], ["jazz", "indie"], ["indie", "soul"]])).toBe("indie");
  });

  // Last.fm tags are user-entered, so the same genre is spelled several ways
  it("counts spelling variants as one tag and keeps the first spelling", () => {
    expect(pickTopTag([["j-pop"], ["JPop"], ["rock"]])).toBe("j-pop");
  });

  it("ignores tags that aren't genres", () => {
    expect(pickTopTag([["seen live", "jazz"], ["seen live", "favorites"]])).toBe("jazz");
  });

  it("breaks ties by the first seed's order", () => {
    expect(pickTopTag([["soul", "funk"], ["funk", "soul"]])).toBe("soul");
  });

  it("returns null when there's no usable tag", () => {
    expect(pickTopTag([[], ["seen live"]])).toBeNull();
  });
});

describe("pickRound", () => {
  const recommended = ["Pond", "GUM", "Temples"].map(song);
  const control = ["Oasis", "Blur", "Pulp"].map(song);

  it("has three songs, with one or two recommended", () => {
    for (const r of [0, 0.49, 0.5, 0.99]) {
      const round = pickRound({ recommended, control, random: sequence(r, 0.3, 0.7, 0.1) })!;
      const count = round.filter((s) => s.isRecommended).length;
      expect(round).toHaveLength(3);
      expect(count).toBe(r < 0.5 ? 1 : 2);
    }
  });

  it("never repeats an artist", () => {
    const round = pickRound({ recommended, control, random: sequence(0.9, 0, 0, 0, 0, 0) })!;
    expect(new Set(round.map((s) => s.artist)).size).toBe(3);
  });

  // Otherwise listeners could learn that, say, the first song is always recommended
  it("shuffles recommended and control songs together", () => {
    const positions = new Set<number>();
    for (const r of [0.05, 0.35, 0.65, 0.95]) {
      const round = pickRound({ recommended, control, random: sequence(0.2, r, r, r, r, r) })!;
      positions.add(round.findIndex((s) => s.isRecommended));
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it("returns null when there aren't enough songs", () => {
    expect(pickRound({ recommended: [song("Pond")], control: [song("Oasis")], random: Math.random })).toBeNull();
  });
});

describe("computeStats", () => {
  const rated = (visitorId: string, isRecommended: boolean, rating: number, algoVersion = "v2"): RatedItem => ({
    visitorId,
    algoVersion,
    isRecommended,
    rating,
  });

  it("averages each visitor's difference between recommended and control ratings", () => {
    const stats = computeStats([
      rated("a", true, 5),
      rated("a", false, 3),
      rated("b", true, 4),
      rated("b", false, 4),
    ]);
    expect(stats).toEqual([
      expect.objectContaining({ algoVersion: "v2", visitors: 2, ratings: 4, recommendedMean: 4.5, controlMean: 3.5, difference: 1 }),
    ]);
  });

  // One heavy player shouldn't outweigh everyone else
  it("counts each visitor once, however many rounds they played", () => {
    const heavy = Array.from({ length: 10 }, () => [rated("a", true, 5), rated("a", false, 1)]).flat();
    const [stats] = computeStats([...heavy, rated("b", true, 2), rated("b", false, 4)]);
    expect(stats!.difference).toBe(1);
    // The averages shown next to the difference count each visitor once too, so they always agree
    expect(stats!.recommendedMean).toBe(3.5);
    expect(stats!.controlMean).toBe(2.5);
  });

  it("leaves out visitors who rated only one kind of song", () => {
    const [stats] = computeStats([rated("a", true, 5), rated("a", false, 3), rated("b", true, 5)]);
    expect(stats!.visitors).toBe(1);
  });

  // 95% CI with Student's t: differences 2, 0, 1 → mean 1, sd 1, n 3, t(2) = 4.303
  it("gives a 95% confidence interval once there are two visitors", () => {
    const [stats] = computeStats([
      rated("a", true, 5),
      rated("a", false, 3),
      rated("b", true, 3),
      rated("b", false, 3),
      rated("c", true, 4),
      rated("c", false, 3),
    ]);
    expect(stats!.ci![0]).toBeCloseTo(1 - 4.303 / Math.sqrt(3), 3);
    expect(stats!.ci![1]).toBeCloseTo(1 + 4.303 / Math.sqrt(3), 3);
  });

  it("has no confidence interval with a single visitor", () => {
    const [stats] = computeStats([rated("a", true, 5), rated("a", false, 3)]);
    expect(stats!.ci).toBeNull();
  });

  it("reports each algorithm version separately", () => {
    const stats = computeStats([
      rated("a", true, 5, "v1"),
      rated("a", false, 3, "v1"),
      rated("a", true, 4, "v2"),
      rated("a", false, 4, "v2"),
    ]);
    expect(stats.map((s) => [s.algoVersion, s.difference])).toEqual([
      ["v1", 2],
      ["v2", 0],
    ]);
  });
});
