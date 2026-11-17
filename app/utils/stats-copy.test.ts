import { describe, expect, it } from "vitest";
import { formatDifference, formatInterval, headline } from "./stats-copy";

describe("formatDifference", () => {
  it("always shows the sign, to one decimal", () => {
    expect(formatDifference(1.09)).toBe("+1.1");
    expect(formatDifference(-0.44)).toBe("−0.4");
    expect(formatDifference(0.02)).toBe("0.0");
  });
});

describe("formatInterval", () => {
  it("gives both ends with their signs", () => {
    expect(formatInterval([0.42, 1.75])).toBe("+0.4 to +1.8");
    expect(formatInterval([-0.6, 0.31])).toBe("−0.6 to +0.3");
  });

  it("says why there is none with a single listener", () => {
    expect(formatInterval(null)).toBe("Needs 2+ listeners");
  });
});

describe("headline", () => {
  it("says which side scored higher, in plain words", () => {
    expect(headline(1.09)).toBe("points higher for picked songs");
    expect(headline(-0.44)).toBe("points lower for picked songs");
    expect(headline(0.02)).toBe("points between picked and random songs");
  });
});
