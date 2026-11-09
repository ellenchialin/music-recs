import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TasteCheckPage from "./taste-check.vue";

// h3's readBody resolves to a different h3 major here than the event registerEndpoint passes in,
// so read the request body stream directly
const readJson = <T>(event: unknown) => new Response((event as { _requestBody: ReadableStream })._requestBody).json() as Promise<T>;

// Fake API: seeds containing "Nowhere" have too few previews (422); ratings reveal song 1 as recommended
let started: unknown[] = [];
let rated: unknown[] = [];
registerEndpoint("/api/blind-tests", {
  method: "POST",
  handler: async (event) => {
    const body = await readJson<{ seeds: string[] }>(event);
    started.push(body);
    if (body.seeds.includes("Nowhere")) throw createError({ statusCode: 422, statusMessage: "Not enough songs" });
    return { id: "11111111-1111-4111-8111-111111111111", songs: [0, 1, 2].map((position) => ({ position, previewUrl: `https://a.mzstatic.com/${position}.m4a` })) };
  },
});
registerEndpoint("/api/blind-tests/11111111-1111-4111-8111-111111111111/ratings", {
  method: "POST",
  handler: async (event) => {
    const { ratings } = await readJson<{ ratings: number[] }>(event);
    rated.push(ratings);
    return ["Pond", "Oasis", "Blur"].map((artist, position) => ({
      position,
      artist,
      title: `${artist} Hit`,
      isRecommended: position === 0,
      rating: ratings[position],
    }));
  },
});
registerEndpoint("/api/stats", () => ({ versions: [] }));

beforeEach(() => {
  started = [];
  rated = [];
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof TasteCheckPage>>>;
const mounted: Page[] = [];
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
});
const open = async (route = "/taste-check?seed=Tame%20Impala") => {
  const page = await mountSuspended(TasteCheckPage, { route });
  mounted.push(page);
  return page;
};
const button = (page: Page, text: string) => page.findAll("button").find((b) => b.text().includes(text));
const start = async (page: Page) => {
  await button(page, "Start")!.trigger("click");
  await vi.waitFor(() => expect(page.findAll('[data-testid="check-song"]')).toHaveLength(3));
};
const rate = async (page: Page, song: number, score: number) => {
  await page.get(`input[name="rating-${song}"][value="${score}"]`).setValue(true);
};

describe("taste check page", () => {
  // Before starting, say what the test answers for the listener, not just how it works
  it("explains what the test tells you before you start", async () => {
    const page = await open();
    expect(page.get("h1").text()).toBe("Taste Check");
    expect(page.text()).toContain("Are these picks really better");
    expect(page.findAll('[data-testid="check-steps"] li')).toHaveLength(3);
    await start(page);
    expect(page.find('[data-testid="check-steps"]').exists()).toBe(false);
    expect(page.text()).toContain("Play each song and rate it");
  });

  // A crawler opening the page shouldn't create rounds
  it("waits for Start before creating a round", async () => {
    const page = await open();
    expect(started).toEqual([]);
    await start(page);
    expect(started).toEqual([{ seeds: ["Tame Impala"] }]);
  });

  it("plays songs without showing who they're by", async () => {
    const page = await open();
    await start(page);
    expect(page.text()).not.toContain("Pond");
    expect(page.findAll('button[aria-label^="Play song"]')).toHaveLength(3);
  });

  it("submits only when every song is rated, then reveals which were recommended", async () => {
    const page = await open();
    await start(page);
    expect(button(page, "Reveal")!.attributes("disabled")).toBeDefined();

    await rate(page, 0, 5);
    await rate(page, 1, 3);
    expect(button(page, "Reveal")!.attributes("disabled")).toBeDefined();
    await rate(page, 2, 1);
    await button(page, "Reveal")!.trigger("click");

    await vi.waitFor(() => expect(page.text()).toContain("Pond"));
    expect(rated).toEqual([[5, 3, 1]]);
    const songs = page.findAll('[data-testid="check-song"]').map((s) => s.text());
    expect(songs[0]).toContain("Picked for you");
    expect(songs[1]).toContain("Random pick");
    expect(page.text()).toContain("The picks won this round.");
  });

  it("explains when there aren't enough songs for these artists", async () => {
    const page = await open("/taste-check?seed=Nowhere");
    await button(page, "Start")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("Not enough songs with previews"));
  });

  it("asks for an artist when the URL has no seeds", async () => {
    const page = await open("/taste-check");
    expect(page.text()).toContain("Pick an artist first");
    expect(button(page, "Start")).toBeUndefined();
  });
});
