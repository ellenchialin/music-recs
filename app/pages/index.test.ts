import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import IndexPage from "./index.vue";

beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof IndexPage>>>;
const recommendButton = (wrapper: Page) => wrapper.findAll("button").find((b) => b.text().includes("Recommend"))!;

// Tests share one router, so unmount pages after each test
const mounted: Page[] = [];
const open = async (route = "/") => {
  const page = await mountSuspended(IndexPage, { route });
  mounted.push(page);
  return page;
};
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
});

describe("index page", () => {
  // The words are separate elements with no space between them, so aria-label gives the name
  it("shows the app title", async () => {
    const page = await open();
    const title = page.get("h1");
    expect(title.attributes("aria-label")).toBe("Music Recs");
    expect(title.findAll("span").map((s) => s.text())).toEqual(["Music", "Recs"]);
  });

  it("shows no placeholder text before any artist is added", async () => {
    const page = await open();
    expect(page.text()).not.toContain("Your artists will appear here");
  });

  it("lists added artists as tags under the record", async () => {
    const page = await open();
    const record = () => page.find('[data-testid="vinyl-record"]');
    const tags = () => page.findAll('ul[aria-label="Your artists"] li').map((li) => li.text().replace("×", "").trim());

    expect(record().exists()).toBe(true);
    expect(tags()).toEqual([]);

    useSeedsStore().add("Tame Impala");
    useSeedsStore().add("Kokoroko");
    await nextTick();

    expect(record().exists()).toBe(true);
    expect(tags()).toEqual(["Tame Impala", "Kokoroko"]);
  });

  it("asks for a seed before recommending", async () => {
    const page = await open();
    expect(recommendButton(page).attributes("disabled")).toBeDefined();
    expect(page.text()).toContain("Pick an artist first");
    useSeedsStore().add("Tame Impala");
    await nextTick();
    expect(recommendButton(page).attributes("disabled")).toBeUndefined();
    expect(page.text()).not.toContain("Pick an artist first");
  });

  it("removes a seed from the list", async () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroko"].forEach((n) => store.add(n));
    const page = await open();
    await page.get('button[aria-label="Remove Tame Impala"]').trigger("click");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("goes to the recommendations page with the seeds", async () => {
    ["Tame Impala", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    const page = await open();
    await recommendButton(page).trigger("click");
    await vi.waitFor(() =>
      expect(useRouter().currentRoute.value).toMatchObject({
        path: "/recommendations",
        query: { seed: ["Tame Impala", "Kokoroko"] },
      }),
    );
    expect(useState("needle-drop").value).toBe(true);
  });

  it("takes the seeds from the URL when coming back from recommendations", async () => {
    useSeedsStore().add("Radiohead");
    await open("/?seed=Tame+Impala&seed=Kokoroko");
    await vi.waitFor(() => expect(useSeedsStore().seeds).toEqual(["Tame Impala", "Kokoroko"]));
    await vi.waitFor(() => expect(useRouter().currentRoute.value.fullPath).toBe("/"));
  });
});
