// Performance budgets for the live-site smoke test, in milliseconds. Two lines per phase, the way
// Core Web Vitals rate pages: at or under `good` is the target; over `poor` fails the run; in between
// is reported but doesn't fail, so one slow network moment doesn't raise an alarm
export type Budget = { good: number; poor: number };
export type Rating = "good" | "needs-improvement" | "poor";
export type Measured = { phase: string; ms: number | null; budget: Budget };

export const BUDGETS = {
  // Core Web Vitals (web.dev)
  ttfb: { good: 800, poor: 1800 },
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  // Recommend → records is a navigation inside the app, so it gets the LCP thresholds
  recommendToRecords: { good: 2500, poor: 4000 },
  // Nielsen: about 1 s keeps the flow of thought; well past it the click feels ignored
  playToSound: { good: 1000, poor: 2500 },
  // The record is on screen with a loading Play button; same patience as pressing Play
  recordsToPreview: { good: 1000, poor: 2500 },
  // Nielsen's 10 s limit for keeping attention, for the whole flow (Playwright types instantly)
  flow: { good: 5000, poor: 10000 },
} satisfies Record<string, Budget>;

export function rate(ms: number | null, { good, poor }: Budget): Rating {
  if (ms === null) return "poor";
  if (ms <= good) return "good";
  return ms <= poor ? "needs-improvement" : "poor";
}

const VERDICTS: Record<Rating, string> = {
  good: "✅ good",
  "needs-improvement": "⚠️ needs improvement",
  poor: "❌ poor",
};

const seconds = (ms: number) => `${ms / 1000} s`;

// A Markdown table for the workflow run's summary page
export function reportTable(title: string, results: Measured[]): string {
  const rows = results.map(({ phase, ms, budget }) => {
    const measured = ms === null ? "not measured" : `${(ms / 1000).toFixed(2)} s`;
    return `| ${phase} | ${measured} | ≤ ${seconds(budget.good)} | > ${seconds(budget.poor)} | ${VERDICTS[rate(ms, budget)]} |`;
  });
  return [`### ${title}`, "", "| Phase | Measured | Good | Poor | Verdict |", "|---|---:|---:|---:|---|", ...rows, ""].join("\n");
}
