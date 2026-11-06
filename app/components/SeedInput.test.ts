import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSeedsStore } from "~/stores/seeds";
import SeedInput from "./SeedInput.vue";

const searched: string[] = [];
// Fake search API: the same two artists for any query, 429 for queries starting with "busy"
registerEndpoint("/api/artists/search", (event) => {
  const q = new URLSearchParams(event.path.split("?")[1]).get("q") ?? "";
  searched.push(q);
  if (q.startsWith("busy")) throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  return [
    { name: "Tame Impala", listeners: 3_000_000 },
    { name: "Tame Impala, JENNIE", listeners: 50_000 },
  ];
});

// The Nuxt app's Pinia is shared between tests
beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
  searched.length = 0;
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mountInput() {
  const wrapper = await mountSuspended(SeedInput);
  return { wrapper, input: wrapper.get("input"), store: useSeedsStore() };
}

async function typeAndWaitForOptions(wrapper: Awaited<ReturnType<typeof mountInput>>["wrapper"], text: string) {
  await wrapper.get("input").setValue(text);
  await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0), { timeout: 2000 });
}

describe("SeedInput", () => {
  it("adds the typed name on Enter and clears the box", async () => {
    const { input, store } = await mountInput();
    await input.setValue("Kokoroko");
    await input.trigger("keydown", { key: "Enter" });
    expect(store.seeds).toEqual(["Kokoroko"]);
    expect((input.element as HTMLInputElement).value).toBe("");
  });

  it("shows suggestions and adds the one clicked", async () => {
    const { wrapper, store } = await mountInput();
    await typeAndWaitForOptions(wrapper, "tame");
    expect(wrapper.findAll('[role="option"]').map((o) => o.text())).toEqual([
      expect.stringContaining("Tame Impala"),
      expect.stringContaining("Tame Impala, JENNIE"),
    ]);
    await wrapper.findAll('[role="option"]')[0]!.trigger("mousedown");
    expect(store.seeds).toEqual(["Tame Impala"]);
  });

  it("adds the highlighted suggestion with the arrow keys and Enter", async () => {
    const { wrapper, input, store } = await mountInput();
    await typeAndWaitForOptions(wrapper, "tame");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.findAll('[role="option"]')[0]!.attributes("aria-selected")).toBe("true");
    await input.trigger("keydown", { key: "Enter" });
    expect(store.seeds).toEqual(["Tame Impala"]);
  });

  // Typical typing leaves 150–300ms between keys
  it("searches once for words typed at a normal pace", async () => {
    const { wrapper, input } = await mountInput();
    for (const text of ["d", "da", "dan", "dani", "danie", "daniel", "daniel c", "daniel ca"]) {
      await input.setValue(text);
      await wait(250);
    }
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0), { timeout: 2000 });
    expect(searched).toEqual(["daniel ca"]);
  });

  it("does not search the same words twice", async () => {
    const { wrapper, input } = await mountInput();
    await typeAndWaitForOptions(wrapper, "daniel");
    await input.setValue("dan");
    await wait(600);
    await input.setValue("daniel");
    await wait(600);
    expect(searched).toEqual(["daniel", "dan"]);
    expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0);
  });

  it("says so when the artist is already a seed", async () => {
    const { wrapper, input, store } = await mountInput();
    store.add("Kokoroko");
    await input.setValue("kokoroko");
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.text()).toContain("Already added");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("says so when there are too many searches", async () => {
    const { wrapper, input, store } = await mountInput();
    await input.setValue("busy signal");
    await vi.waitFor(() => expect(wrapper.text()).toContain("Too many searches"), { timeout: 2000 });
    await input.trigger("keydown", { key: "Enter" });
    expect(store.seeds).toEqual(["busy signal"]);
  });
});
