import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import App from "../app.vue";
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
const mountedApps: { unmount: () => void }[] = [];
afterEach(() => {
  mounted.splice(0).forEach((page) => page.unmount());
  mountedApps.splice(0).forEach((app) => app.unmount());
});

describe("index page", () => {
  // The title comes from app.vue's site-wide default, so mount the whole app.
  // Without it the tab and bookmarks showed only the URL
  it("has a page title", async () => {
    // Unmounted with the pages after each test, even when an assertion fails
    mountedApps.push(await mountSuspended(App, { route: "/" }));
    await vi.waitFor(() => expect(document.title).toBe("Music Recs"));
  });

  // What search results and link previews say about the site: both ways in
  it("describes the site as artists or a vibe", async () => {
    mountedApps.push(await mountSuspended(App, { route: "/" }));
    const description = () => document.querySelector('meta[name="description"]')?.getAttribute("content");
    await vi.waitFor(() =>
      expect(description()).toBe(
        "Name a few artists or describe a vibe, and get ten records you can preview, with a way to dig deeper from any of them.",
      ),
    );
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute("content")).toBe(description());
  });


  // The words are separate elements with no space between them, so aria-label gives the name
  it("shows the app title", async () => {
    const page = await open();
    const title = page.get("h1");
    expect(title.attributes("aria-label")).toBe("Music Recs");
    expect(title.findAll("span").map((s) => s.text())).toEqual(["Music", "Recs"]);
  });

  // Recommend is the one action here; the results are linked from the Taste Check instead
  it("doesn't link away from picking artists", async () => {
    const page = await open();
    expect(page.findAll("a").some((a) => a.attributes("href") === "/stats")).toBe(false);
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
    expect(page.text()).toContain("Add an artist first");
    useSeedsStore().add("Tame Impala");
    await nextTick();
    expect(recommendButton(page).attributes("disabled")).toBeUndefined();
    expect(page.text()).not.toContain("Add an artist first");
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

  describe("two ways to start", () => {
    const mode = (page: Page, value: string) => page.get(`input[name="start-mode"][value="${value}"]`);
    const checkedMode = (page: Page) =>
      page.findAll('input[name="start-mode"]').find((i) => (i.element as HTMLInputElement).checked)?.attributes("value");
    const button = (page: Page, text: string) => page.findAll("button").find((b) => b.text().includes(text));
    const panel = (page: Page, name: string) => page.get(`[data-testid="start-${name}"]`);

    it("says there are two ways, and starts with picking artists", async () => {
      const page = await open();

      expect(page.text()).toContain("Name a few artists, or just describe what you're in the mood for.");
      expect(page.get("fieldset legend").text()).toBe("Start from");
      expect(page.get("fieldset").findAll("label").map((l) => l.text())).toEqual(["By artist", "By vibe"]);
      expect(checkedMode(page)).toBe("artists");
      expect(panel(page, "artists").attributes("inert")).toBeUndefined();
      expect(panel(page, "vibe").attributes("inert")).toBeDefined();
    });

    it("swaps the artist search for a description box", async () => {
      const page = await open();

      await mode(page, "vibe").setValue(true);

      const box = page.get("textarea");
      expect(box.attributes("maxlength")).toBe("200");
      expect(box.attributes("placeholder")).toMatch(/^e\.g\. /);
      // Both stay in the layout, so switching doesn't move anything; only one can be used
      expect(panel(page, "vibe").attributes("inert")).toBeUndefined();
      expect(panel(page, "artists").attributes("inert")).toBeDefined();
      expect(button(page, "Find artists")!.attributes("disabled")).toBeDefined();
      expect(button(page, "Recommend")).toBeUndefined();
    });

    it("hands the description to the describe page, which starts at once", async () => {
      const page = await open();
      await mode(page, "vibe").setValue(true);

      await page.get("textarea").setValue("  Like Tame Impala, but for running ");
      await button(page, "Find artists")!.trigger("click");

      await vi.waitFor(() =>
        expect(useRouter().currentRoute.value).toMatchObject({ path: "/describe", query: { q: "Like Tame Impala, but for running" } }),
      );
      expect(useState("describe-now").value).toBe(true);
    });
  });
});
