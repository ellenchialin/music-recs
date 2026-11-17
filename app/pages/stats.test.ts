import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { StatsResult } from "~~/shared/types/stats";
import StatsPage from "./stats.vue";

const v2 = { algoVersion: "v2", visitors: 30, ratings: 96, recommendedMean: 3.97, controlMean: 2.88, difference: 1.09, ci: [0.42, 1.75] as [number, number] };
const full: StatsResult = {
  versions: [{ ...v2, algoVersion: "v1", visitors: 4, ratings: 12, difference: 0.2, ci: [-0.9, 1.3] }, v2],
  settings: [
    { popularity: "obscure", visitors: 1, ratings: 3, recommendedMean: 4, controlMean: 3, difference: 1, ci: null },
    { popularity: "balanced", visitors: 30, ratings: 96, recommendedMean: 3.97, controlMean: 2.88, difference: 1.09, ci: [0.42, 1.75] },
  ],
};
let response: StatsResult | "fail" = full;
registerEndpoint("/api/stats", () => {
  if (response === "fail") throw createError({ statusCode: 500 });
  return response;
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof StatsPage>>>;
const mounted: Page[] = [];
beforeEach(() => {
  response = full;
  clearNuxtData();
});
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
});
const open = async (route = "/stats") => {
  const page = await mountSuspended(StatsPage, { route });
  mounted.push(page);
  return page;
};
const rows = (page: Page, testId: string) =>
  page.findAll(`[data-testid="${testId}"] tbody tr`).map((tr) => tr.findAll("th, td").map((cell) => cell.text()));

describe("stats page", () => {
  it("leads with the latest version's difference and a plain verdict", async () => {
    const page = await open();

    expect(page.get("h1").text()).toBe("Does it work?");
    expect(page.get('[data-testid="headline"]').text()).toContain("+1.1");
    expect(page.get('[data-testid="headline"]').text()).toContain("points higher for picked songs");
    expect(page.text()).toContain("Across 30 listeners, songs picked for them averaged 4.0 out of 5, random picks 2.9. The algorithm has taste.");
  });

  it("draws both averages as labeled bars on the same 0–5 scale", async () => {
    const page = await open();

    const bars = page.findAll('[data-testid="average-bar"]');
    expect(bars.map((b) => b.text())).toEqual(["Picked for you4.0", "Random pick2.9"]);
    expect(bars.map((b) => b.get("[data-fill]").attributes("style"))).toEqual(["width: 79.4%;", "width: 57.6%;"]);
  });

  it("compares the popularity settings, saying when there are too few listeners", async () => {
    const page = await open();

    expect(rows(page, "by-setting")).toEqual([
      ["Obscure", "1", "4.0", "3.0", "+1.0", "Needs 2+ listeners"],
      ["Balanced", "30", "4.0", "2.9", "+1.1", "+0.4 to +1.8"],
    ]);
  });

  it("compares algorithm versions once there is more than one", async () => {
    const page = await open();
    expect(rows(page, "by-version")).toEqual([
      ["v1", "4", "4.0", "2.9", "+0.2", "−0.9 to +1.3"],
      ["v2", "30", "4.0", "2.9", "+1.1", "+0.4 to +1.8"],
    ]);

    response = { versions: [v2], settings: full.settings };
    clearNuxtData();
    const single = await open();
    expect(single.find('[data-testid="by-version"]').exists()).toBe(false);
  });

  it("invites the first round when nobody has played yet", async () => {
    response = { versions: [], settings: [] };

    const page = await open();

    expect(page.text()).toContain("No rounds have been rated yet");
    expect(page.find('[data-testid="headline"]').exists()).toBe(false);
    expect(page.findAll("a").some((a) => a.attributes("href") === "/")).toBe(true);
  });

  it("says so when the results can't be loaded", async () => {
    response = "fail";

    const page = await open();

    expect(page.get('[role="alert"]').text()).toContain("Couldn't load the results");
  });

  describe("coming from a Taste Check", () => {
    const crumbs = (page: Page) => page.findAll('nav[aria-label="Breadcrumb"] li').map((li) => li.text().replace("›", "").trim());
    const link = (page: Page, text: string) => page.findAll("a").find((a) => a.text() === text);

    it("leads back to the visitor's recommendations, with their setting", async () => {
      const page = await open("/stats?seed=Tame%20Impala&seed=Kokoroko&popularity=obscure");

      expect(crumbs(page)).toEqual(["Home", "Tame Impala + Kokoroko", "Results"]);
      const crumb = page.findAll('nav[aria-label="Breadcrumb"] a').find((a) => a.text() === "Tame Impala + Kokoroko");
      expect(crumb?.attributes("href")).toBe("/recommendations?seed=Tame+Impala&seed=Kokoroko&popularity=obscure");
      expect(link(page, "Back to your recommendations")?.attributes("href")).toBe(
        "/recommendations?seed=Tame+Impala&seed=Kokoroko&popularity=obscure",
      );
      expect(link(page, "Take another Taste Check")?.attributes("href")).toBe(
        "/taste-check?seed=Tame+Impala&seed=Kokoroko&popularity=obscure",
      );
    });

    it("offers to start from scratch when opened without any artists", async () => {
      const page = await open();

      expect(crumbs(page)).toEqual(["Home", "Results"]);
      expect(link(page, "Back to your recommendations")).toBeUndefined();
      expect(link(page, "Pick artists")?.attributes("href")).toBe("/");
    });
  });
});
