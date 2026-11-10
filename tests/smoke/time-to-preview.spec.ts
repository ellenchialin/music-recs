import { appendFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { addArtist, recordPreviewProgress } from "../helpers/browser";
import { BUDGETS, rate, reportTable, type Measured } from "./budgets";

// One artist per day, in turn. With more artists than the cache's 30 days, the first run of the day
// (desktop) usually finds its artist uncached and measures the slow path; mobile runs next and
// finds it cached, so it measures the phone and network rather than the APIs
const ARTISTS = [
  "Tame Impala", "Kokoroko", "Khruangbin", "Radiohead", "Arctic Monkeys", "Phoebe Bridgers", "Mac DeMarco",
  "Bon Iver", "Beach House", "The National", "Vampire Weekend", "Fleet Foxes", "Alvvays", "Mitski",
  "Steve Lacy", "Thundercat", "Hiatus Kaiyote", "Snarky Puppy", "Ezra Collective", "Nubya Garcia",
  "Men I Trust", "Clairo", "Portishead", "Massive Attack", "Bonobo", "Floating Points", "Four Tet",
  "Jamie xx", "Unknown Mortal Orchestra", "Japanese Breakfast", "Big Thief",
];
const day = Math.floor(Date.now() / 86_400_000);
const artist = process.env.SMOKE_ARTIST ?? ARTISTS[day % ARTISTS.length]!;

declare global {
  interface Window {
    smoke?: { lcp: number | null; inp: number | null; playingAt: number | null };
  }
}

test.beforeEach(async ({ context }) => {
  // Only real visitors should make the site call the LLM; records fall back to "Similar to …".
  // Reasons load after the records and aren't timed, so the measurements don't change
  await context.route("**/api/reasons**", (route) => route.fulfill({ json: { reasons: {} } }));
  await recordPreviewProgress(context);
  // Collected in the page from the start, before any of our code runs
  await context.addInitScript(() => {
    const smoke = { lcp: null as number | null, inp: null as number | null, playingAt: null as number | null };
    window.smoke = smoke;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) smoke.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    // INP is close to the slowest interaction when there are only a few. TypeScript's DOM types
    // don't have interactionId or durationThreshold yet
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEventTiming & { interactionId?: number })[]) {
        if (entry.interactionId) smoke.inp = Math.max(smoke.inp ?? 0, entry.duration);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener("playing", () => (smoke.playingAt ??= performance.now()), { once: true });
      return play.call(this);
    };
  });
});

test(`the main flow stays within its performance budgets (${artist})`, async ({ page }, testInfo) => {
  if (testInfo.project.name === "mobile") {
    // Lighthouse's mobile profile: slow 4G (150 ms round trip, 1.6 Mbps down) and a 4× slower CPU
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 1_600_000 / 8,
      uploadThroughput: 750_000 / 8,
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }

  const started = Date.now();
  await page.goto("/");
  // The browser stops looking for the largest paint at the first input, so let it report before
  // typing; a visitor doesn't type in the first few hundred milliseconds either
  await expect
    .poll(() => page.evaluate(() => window.smoke!.lcp), { timeout: BUDGETS.lcp.poor })
    .not.toBeNull()
    .catch(() => {});
  await addArtist(page, artist);
  const ttfb = await page.evaluate(
    () => (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.responseStart ?? null,
  );
  const lcp = await page.evaluate(() => window.smoke!.lcp);

  const recommendClicked = Date.now();
  await page.getByRole("button", { name: "Recommend" }).click();
  await expect(page.getByRole("group", { name: /^1 of / })).toBeVisible({ timeout: 30_000 });
  const recommendToRecords = Date.now() - recommendClicked;

  // Records show before their previews; wait for the first one's to load (or turn out missing)
  const play = page.getByRole("button", { name: /^Play preview of / });
  const settled = play.or(page.getByText("No preview")).or(page.getByText("Preview failed to load"));
  const recordsShown = Date.now();
  await expect(settled).toBeVisible({ timeout: 30_000 });
  const recordsToPreview = Date.now() - recordsShown;

  // Like a visitor, skip records without a preview until one can play. Not timed: it's the
  // visitor's choice, not the site's speed
  for (let i = 0; i < 10 && !(await play.isVisible()); i++) {
    await page.getByRole("button", { name: "Next record" }).click();
    await expect(settled).toBeVisible({ timeout: 30_000 });
  }
  const playClickedAt = await page.evaluate(() => performance.now());
  await play.click();
  await expect.poll(() => page.evaluate(() => window.smoke!.playingAt), { timeout: 30_000 }).not.toBeNull();
  const playToSound = (await page.evaluate(() => window.smoke!.playingAt!)) - playClickedAt;
  const inp = await page.evaluate(() => window.smoke!.inp);
  // Wall clock: Playwright's typing and clicks take milliseconds, so this is the site's time
  const flow = Date.now() - started;

  const results: Measured[] = [
    { phase: "Server response (TTFB)", ms: ttfb, budget: BUDGETS.ttfb },
    { phase: "Home page loaded (LCP)", ms: lcp, budget: BUDGETS.lcp },
    { phase: "Recommend → records", ms: recommendToRecords, budget: BUDGETS.recommendToRecords },
    { phase: "Records → first preview ready", ms: recordsToPreview, budget: BUDGETS.recordsToPreview },
    { phase: "Play → sound", ms: playToSound, budget: BUDGETS.playToSound },
    { phase: "Click response (INP)", ms: inp, budget: BUDGETS.inp },
    { phase: "Whole flow", ms: flow, budget: BUDGETS.flow },
  ];
  report(reportTable(`${testInfo.project.name}: ${artist}`, results));

  const poor = results.filter((r) => rate(r.ms, r.budget) === "poor").map((r) => r.phase);
  expect(poor, "phases over their poor threshold").toEqual([]);
});

function report(markdown: string) {
  console.log(markdown);
  // Shown on the workflow run's summary page
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
