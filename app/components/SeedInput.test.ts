import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSeedsStore } from "~/stores/seeds";
import SeedInput from "./SeedInput.vue";

const searched: string[] = [];
// Fake search API: the same two artists for any query, 429 for queries starting with "busy",
// nothing for "zzq…". Waits for `gate` when one is set, like a slow Last.fm
let gate: Promise<void> | null = null;
registerEndpoint("/api/artists/search", async (event) => {
  const q = new URLSearchParams(event.path.split("?")[1]).get("q") ?? "";
  searched.push(q);
  if (gate) await gate;
  if (q.startsWith("busy")) throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  if (q.startsWith("zzq")) return [];
  return [
    { name: "Tame Impala", listeners: 3_000_000 },
    { name: "Tame Impala, JENNIE", listeners: 50_000 },
  ];
});

// Fake instant search over names we already know: only "tame…" and "pon…" match.
// knownFailures[q] requests for q fail first; $fetch retries a 429 once, so a visible failure takes two
const known: string[] = [];
let knownFailures: Record<string, number> = {};
registerEndpoint("/api/artists/known", (event) => {
  const q = new URLSearchParams(event.path.split("?")[1]).get("q") ?? "";
  known.push(q);
  if ((knownFailures[q] ?? 0) > 0) {
    knownFailures[q]!--;
    throw createError({ statusCode: 429, statusMessage: "Too many requests" });
  }
  if (q.startsWith("tame")) return [{ name: "Tame Impala", listeners: 3_000_000 }];
  if (q.startsWith("pon")) return [{ name: "Pond", listeners: null }];
  return [];
});

// The Nuxt app's Pinia is shared between tests
beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
  searched.length = 0;
  known.length = 0;
  knownFailures = {};
  gate = null;
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mountInput() {
  const wrapper = await mountSuspended(SeedInput);
  return { wrapper, input: wrapper.get("input"), store: useSeedsStore() };
}

// Waits for Last.fm's answer too, not just the instant matches shown before it
async function typeAndWaitForOptions(wrapper: Awaited<ReturnType<typeof mountInput>>["wrapper"], text: string) {
  await wrapper.get("input").setValue(text);
  await vi.waitFor(
    () => {
      expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0);
      expect(wrapper.get("#seed-input-hint").text()).not.toBe("Searching…");
    },
    { timeout: 2000 },
  );
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
    await vi.waitFor(() => expect(wrapper.get("#seed-input-hint").text()).not.toBe("Searching…"), { timeout: 2000 });
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

  // Last.fm's search takes 1–3 s; without feedback the box looks broken
  it("shows that it's searching from the first keystroke until results arrive", async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const { wrapper, input } = await mountInput();
    await input.setValue("tame");
    expect(wrapper.get("#seed-input-hint").text()).toBe("Searching…");
    release();
    await vi.waitFor(() => expect(wrapper.get("#seed-input-hint").text()).not.toBe("Searching…"), { timeout: 2000 });
  });

  it("doesn't search or show searching for a single letter", async () => {
    const { wrapper, input } = await mountInput();
    await input.setValue("t");
    expect(wrapper.get("#seed-input-hint").text()).not.toBe("Searching…");
    await wait(500);
    expect([...known, ...searched]).toEqual([]);
  });

  it("says when nothing matches, and that Enter still adds the name", async () => {
    const { wrapper, input, store } = await mountInput();
    await input.setValue("zzqx band");
    await vi.waitFor(() => expect(wrapper.get("#seed-input-hint").text()).toBe("No matches. Press Enter to add it anyway."), {
      timeout: 2000,
    });
    await input.trigger("keydown", { key: "Enter" });
    expect(store.seeds).toEqual(["zzqx band"]);
  });

  // Our own names answer in milliseconds; Last.fm takes seconds
  it("shows names we already know while Last.fm is still searching", async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const { wrapper, input } = await mountInput();
    await input.setValue("tame");
    const options = () => wrapper.findAll('[role="option"]').map((o) => o.text());
    await vi.waitFor(() => expect(options()).toEqual([expect.stringContaining("Tame Impala")]), { timeout: 2000 });
    expect(wrapper.get("#seed-input-hint").text()).toBe("Searching…");

    release();
    // Last.fm's extra match is added below, without moving what's already there
    await vi.waitFor(() => expect(options()).toHaveLength(2), { timeout: 2000 });
    expect(options()[0]).toContain("Tame Impala");
    expect(options()[1]).toContain("Tame Impala, JENNIE");
  });

  it("leaves out the listener count when we don't know it", async () => {
    const { wrapper, input } = await mountInput();
    await input.setValue("pon");
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').map((o) => o.text())).toContain("Pond"), { timeout: 2000 });
  });

  describe("while Last.fm is slow", () => {
    let release: () => void;
    beforeEach(() => {
      gate = new Promise((r) => (release = r));
    });
    const options = (wrapper: Awaited<ReturnType<typeof mountInput>>["wrapper"]) =>
      wrapper.findAll('[role="option"]').map((o) => o.text());

    // Tapping elsewhere on a phone shouldn't bring the list back seconds later
    it("keeps the list closed after leaving the box, even when answers arrive later", async () => {
      const { wrapper, input } = await mountInput();
      await input.setValue("tame");
      await vi.waitFor(() => expect(options(wrapper)).toHaveLength(1), { timeout: 2000 });
      await input.trigger("blur");
      release();
      await wait(600);
      expect(options(wrapper)).toEqual([]);
    });

    it("keeps the list closed after Escape, even when answers arrive later", async () => {
      const { wrapper, input } = await mountInput();
      await input.setValue("tame");
      await input.trigger("keydown", { key: "Escape" });
      release();
      await wait(600);
      expect(options(wrapper)).toEqual([]);
    });

    it("keeps the highlighted name when Last.fm's answer arrives", async () => {
      const { wrapper, input, store } = await mountInput();
      await input.setValue("tame");
      await vi.waitFor(() => expect(options(wrapper)).toHaveLength(1), { timeout: 2000 });
      await input.trigger("keydown", { key: "ArrowDown" });
      release();
      await vi.waitFor(() => expect(options(wrapper)).toHaveLength(2), { timeout: 2000 });
      expect(wrapper.findAll('[role="option"]')[0]!.attributes("aria-selected")).toBe("true");
      await input.trigger("keydown", { key: "Enter" });
      expect(store.seeds).toEqual(["Tame Impala"]);
    });

    // Narrowing the search keeps what still matches instead of collapsing the list
    it("keeps names that still match while the next search runs", async () => {
      release();
      const { wrapper, input } = await mountInput();
      await typeAndWaitForOptions(wrapper, "tame");
      gate = new Promise((r) => (release = r));
      await input.setValue("tame impala, j");
      expect(options(wrapper)).toEqual([expect.stringContaining("Tame Impala, JENNIE")]);
      await wait(250);
      expect(options(wrapper)).toEqual([expect.stringContaining("Tame Impala, JENNIE")]);
      release();
    });
  });

  // A failed instant search isn't remembered as "nothing": the Last.fm step asks again
  it("still finds names we know when the first instant search fails", async () => {
    knownFailures = { pon: 2 };
    const { wrapper } = await mountInput();
    await typeAndWaitForOptions(wrapper, "pon");
    expect(wrapper.findAll('[role="option"]').map((o) => o.text())).toContain("Pond");
  });
});

