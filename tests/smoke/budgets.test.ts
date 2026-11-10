import { describe, expect, it } from "vitest";
import { rate, reportTable, type Measured } from "./budgets";

describe("rate", () => {
  const budget = { good: 2500, poor: 4000 };

  it("is good up to and including the good threshold", () => {
    expect(rate(2500, budget)).toBe("good");
  });

  it("needs improvement between the two thresholds", () => {
    expect(rate(2501, budget)).toBe("needs-improvement");
    expect(rate(4000, budget)).toBe("needs-improvement");
  });

  it("is poor above the poor threshold", () => {
    expect(rate(4001, budget)).toBe("poor");
  });

  // A metric the browser didn't report must not count as fast
  it("treats a missing measurement as poor", () => {
    expect(rate(null, budget)).toBe("poor");
  });
});

describe("reportTable", () => {
  const results: Measured[] = [
    { phase: "Home page LCP", ms: 812, budget: { good: 2500, poor: 4000 } },
    { phase: "Play → sound", ms: 2100, budget: { good: 1000, poor: 2500 } },
    { phase: "Click response (INP)", ms: null, budget: { good: 200, poor: 500 } },
  ];

  it("shows each phase in seconds with its thresholds and verdict", () => {
    expect(reportTable("Desktop", results).split("\n")).toEqual([
      "### Desktop",
      "",
      "| Phase | Measured | Good | Poor | Verdict |",
      "|---|---:|---:|---:|---|",
      "| Home page LCP | 0.81 s | ≤ 2.5 s | > 4 s | ✅ good |",
      "| Play → sound | 2.10 s | ≤ 1 s | > 2.5 s | ⚠️ needs improvement |",
      "| Click response (INP) | not measured | ≤ 0.2 s | > 0.5 s | ❌ poor |",
      "",
    ]);
  });
});
