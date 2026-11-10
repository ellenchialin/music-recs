import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardPreview, RecommendationCard, RecommendationsResult } from "~~/shared/types/recommendations";
import RecommendationsPage from "./recommendations.vue";

// Fake API: "Kokoroco" (misspelled) → 404; user seeds → Khruangbin, Nowhere; exploring X →
// "X Friend 1", "X Friend 2"; exploring Nowhere → nothing new. Records every request
let requests: { seeds: string[]; exclude: string[] }[] = [];
let gate: Promise<void> | null = null;
let throttled = false;
const card = (artist: string): RecommendationCard => ({
  artist,
  score: 0.2,
  sources: ["Tame Impala"],
  track: { title: `${artist} Hit`, artworkUrl: null },
  preview: { status: "unavailable" },
});
// The seed "Slow Lane" gets cards whose previews aren't cached yet
const pendingCard = (artist: string): RecommendationCard => ({ ...card(artist), track: null, preview: { status: "pending" } });
registerEndpoint("/api/recommendations", async (event) => {
  if (gate) await gate;
  const query = new URLSearchParams(event.path.split("?")[1]);
  const seeds = query.getAll("seed");
  const exclude = query.getAll("exclude");
  requests.push({ seeds, exclude });
  if (throttled) throw createError({ statusCode: 429, statusMessage: "Too many requests, try again in a minute" });
  if (seeds.includes("Kokoroco")) {
    throw createError({ statusCode: 404, data: { seed: "Kokoroco", suggestions: ["Kokoroko", "LocoRoco"] } });
  }
  const seed = seeds[0]!;
  const artists = !exclude.length ? ["Khruangbin", "Nowhere"] : seed === "Nowhere" ? [] : [`${seed} Friend 1`, `${seed} Friend 2`];
  const result: RecommendationsResult = {
    algoVersion: "v2",
    seeds,
    recommendations: seed === "Slow Lane" ? ["Pond", "MGMT"].map(pendingCard) : artists.map(card),
  };
  return result;
});

// Fake preview API: every artist has "<artist> Hit". failures[artist] requests fail first; $fetch
// retries a failed GET once on its own, so failing the visitor's first try takes two
let previewRequests: string[] = [];
let failures: Record<string, number> = {};
registerEndpoint("/api/previews", async (event) => {
  const artist = new URLSearchParams(event.path.split("?")[1]).get("artist")!;
  previewRequests.push(artist);
  if ((failures[artist] ?? 0) > 0) {
    failures[artist]!--;
    throw createError({ statusCode: 500 });
  }
  const found: CardPreview = {
    track: { title: `${artist} Hit`, artworkUrl: null },
    preview: { status: "available", url: `https://audio.example/${encodeURIComponent(artist)}.m4a` },
  };
  return found;
});

// Fake reasons API: a reason for Khruangbin only; records each query
let reasonRequests: { seeds: string[]; exclude: string[] }[] = [];
registerEndpoint("/api/reasons", async (event) => {
  const query = new URLSearchParams(event.path.split("?")[1]);
  reasonRequests.push({ seeds: query.getAll("seed"), exclude: query.getAll("exclude") });
  return { reasons: { Khruangbin: "Same hazy, groove-first guitar.", Nowhere: null } };
});

beforeEach(() => {
  reasonRequests = [];
  requests = [];
  previewRequests = [];
  failures = {};
  gate = null;
  throttled = false;
  // Levels live in useState and useAsyncData results persist per key in the Nuxt app
  clearNuxtState();
  clearNuxtData();
  Element.prototype.scrollIntoView = vi.fn();
});

// Tests share one router; a page left mounted would keep reacting to URL changes
const mounted: Page[] = [];
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
});

const SEEDS = "/recommendations?seed=Tame%20Impala&seed=Kokoroko";
type Page = Awaited<ReturnType<typeof mountSuspended<typeof RecommendationsPage>>>;
const open = async (route: string) => {
  const page = await mountSuspended(RecommendationsPage, { route });
  mounted.push(page);
  return page;
};
const recordNames = (page: Page) =>
  page.findAll('[aria-roledescription="slide"]').map((r) => r.attributes("aria-label")!.split(": ")[1]);
const heading = (page: Page) => page.get("h1").text();
const crumbs = (page: Page) => page.findAll('nav[aria-label="Breadcrumb"] li').map((li) => li.text().replace("›", "").trim());
const crumbLink = (page: Page, text: string) =>
  page.findAll('nav[aria-label="Breadcrumb"] a').find((a) => a.text() === text)!;
const button = (page: Page, label: string) => page.findAll("button").find((b) => b.attributes("aria-label") === label);
// Compare parsed queries: Vue Router encodes spaces as "+"
const currentQuery = () => useRouter().currentRoute.value.query;
const SEEDS_QUERY = { seed: ["Tame Impala", "Kokoroko"] };

describe("recommendations page", () => {
  it("recommends from the seeds in the URL", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toEqual(["Khruangbin", "Nowhere"]));
    expect(heading(page)).toBe("Recommended for you");
    expect(requests).toEqual([{ seeds: ["Tame Impala", "Kokoroko"], exclude: [] }]);
  });

  it("links home with the seeds so they can be changed", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(crumbs(page)).toEqual(["Home", "Tame Impala + Kokoroko"]));
    expect(crumbLink(page, "Home").attributes("href")).toBe("/?seed=Tame+Impala&seed=Kokoroko");
  });

  it("links to a taste check of these seeds", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    // Asks the visitor's question rather than naming the feature
    const link = page.findAll("a").find((a) => a.text().includes("Fit your taste?"))!;
    expect(link.attributes("href")).toBe("/taste-check?seed=Tame+Impala&seed=Kokoroko");
  });

  it("explores by adding a level to the URL", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));

    await button(page, "Explore artists like Khruangbin")!.trigger("click");

    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin"));
    expect(currentQuery()).toEqual({ ...SEEDS_QUERY, explore: ["Khruangbin"] });
    expect(recordNames(page)).toEqual(["Khruangbin Friend 1", "Khruangbin Friend 2"]);
    expect(crumbs(page)).toEqual(["Home", "Tame Impala + Kokoroko", "Khruangbin"]);
    expect(requests.at(-1)).toEqual({ seeds: ["Khruangbin"], exclude: ["Tame Impala", "Kokoroko", "Khruangbin", "Nowhere"] });
  });

  it("opens a shared link that explored a level", async () => {
    const page = await open(`${SEEDS}&explore=Khruangbin`);
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin"));
    expect(requests).toEqual([
      { seeds: ["Tame Impala", "Kokoroko"], exclude: [] },
      { seeds: ["Khruangbin"], exclude: ["Tame Impala", "Kokoroko", "Khruangbin", "Nowhere"] },
    ]);
  });

  it("goes back along the breadcrumb without reloading", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    await button(page, "Next record")!.trigger("click");
    await button(page, "Previous record")!.trigger("click");
    await button(page, "Explore artists like Khruangbin")!.trigger("click");
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin"));
    const calls = requests.length;

    // Clicking <a> doesn't navigate in happy-dom; check the href and navigate with the router
    const href = crumbLink(page, "Tame Impala + Kokoroko").attributes("href")!;
    expect(href).toBe("/recommendations?seed=Tame+Impala&seed=Kokoroko");
    await useRouter().push(href);

    await vi.waitFor(() => expect(heading(page)).toBe("Recommended for you"));
    expect(currentQuery()).toEqual(SEEDS_QUERY);
    expect(requests).toHaveLength(calls);
  });

  it("hides Explore three levels deep", async () => {
    const page = await open(`${SEEDS}&explore=Khruangbin&explore=Khruangbin%20Friend%201&explore=Khruangbin%20Friend%201%20Friend%201`);
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin Friend 1 Friend 1"));
    expect(page.text()).not.toContain("Explore from here");
  });

  it("stays put when there is nothing new to explore", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    await button(page, "Next record")!.trigger("click");
    await button(page, "Explore artists like Nowhere")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("No new artists here — try another record"));
    expect(currentQuery()).toEqual(SEEDS_QUERY);
    await button(page, "Previous record")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).not.toContain("No new artists here"));
    expect(button(page, "Explore artists like Khruangbin")).toBeDefined();
  });

  it("suggests a fix when a seed is not found", async () => {
    const page = await open("/recommendations?seed=Tame%20Impala&seed=Kokoroco");
    await vi.waitFor(() => expect(page.text()).toContain('Can\'t find "Kokoroco"'));

    await page.findAll("button").find((b) => b.text() === "Kokoroko")!.trigger("click");

    await vi.waitFor(() => expect(currentQuery()).toEqual(SEEDS_QUERY));
  });

  it("asks for an artist when the URL has no seeds", async () => {
    const page = await open("/recommendations");
    expect(page.text()).toContain("Pick an artist first");
    expect(page.find('a[href="/"]').exists()).toBe(true);
  });

  it("shows the turntable while loading", async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const page = await open(SEEDS);
    expect(page.find('[role="status"]').text()).toContain("Finding recommendations");
    expect(page.find('[data-testid="vinyl-record"]').exists()).toBe(true);
    release();
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
  });

  // Even when data is instant, so the turntable doesn't flash past
  it("plays the needle drop when arriving from home, then shows the records", async () => {
    useState("needle-drop").value = true;
    const page = await open(SEEDS);
    expect(page.find('[role="status"]').exists()).toBe(true);
    expect(page.findAll('[aria-roledescription="slide"]')).toHaveLength(0);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2), { timeout: 3000 });
    expect(page.find('[role="status"]').exists()).toBe(false);
  });

  it("shows the records right away on a direct visit", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2), { timeout: 300 });
  });

  it("asks to wait when there are too many requests", async () => {
    throttled = true;
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(page.text()).toContain("Too many requests"));
    expect(page.text()).not.toContain("Music data is unavailable");

    throttled = false;
    await page.findAll("button").find((b) => b.text() === "Try again")!.trigger("click");
    await vi.waitFor(() => expect(recordNames(page)).toEqual(["Khruangbin", "Nowhere"]));
  });

  it("asks to wait when exploring hits the limit", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    throttled = true;
    await button(page, "Explore artists like Khruangbin")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("Too many requests — try again in a minute"));
    expect(currentQuery()).toEqual(SEEDS_QUERY);
  });

  it("shows the records first and fills in previews that weren't cached", async () => {
    const page = await open("/recommendations?seed=Slow%20Lane");
    await vi.waitFor(() => expect(recordNames(page)).toEqual(["Pond", "MGMT"]));
    await vi.waitFor(() => expect(button(page, "Play preview of Pond Hit")).toBeDefined());
    expect(previewRequests.sort()).toEqual(["MGMT", "Pond"]);
  });

  it("retries only the preview that failed", async () => {
    failures = { Pond: 2 };
    const page = await open("/recommendations?seed=Slow%20Lane");
    await vi.waitFor(() => expect(page.text()).toContain("Preview failed to load"));

    await page.findAll("button").find((b) => b.text() === "Retry")!.trigger("click");

    await vi.waitFor(() => expect(button(page, "Play preview of Pond Hit")).toBeDefined());
    expect(previewRequests.filter((a) => a === "Pond")).toHaveLength(3);
    expect(requests).toHaveLength(1);
  });

  it("asks for reasons with the same query once the records are shown", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(page.text()).toContain("Same hazy, groove-first guitar."));
    expect(reasonRequests).toEqual([{ seeds: ["Tame Impala", "Kokoroko"], exclude: [] }]);
  });

  it("falls back to where a record came from when it has no reason", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(page.text()).toContain("Same hazy, groove-first guitar."));
    await button(page, "Next record")!.trigger("click");
    await vi.waitFor(() => expect(page.get('[data-testid="record-reason"]').text()).toBe("Similar to Tame Impala"));
  });

  it("asks for an explored level's reasons with that level's query", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    await button(page, "Explore artists like Khruangbin")!.trigger("click");
    await vi.waitFor(() => expect(reasonRequests).toHaveLength(2));
    expect(reasonRequests[1]).toEqual(requests[1]);
  });
});

