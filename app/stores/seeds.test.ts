import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { MAX_SEEDS, MIN_SEEDS, useSeedsStore } from "./seeds";

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe("useSeedsStore", () => {
  it("adds seeds in order, trimmed", () => {
    const store = useSeedsStore();
    expect(store.add(" Tame Impala ")).toBe("added");
    expect(store.add("Kokoroko")).toBe("added");
    expect(store.seeds).toEqual(["Tame Impala", "Kokoroko"]);
  });

  it("refuses the same artist twice", () => {
    const store = useSeedsStore();
    store.add("Tame Impala");
    expect(store.add("tame  impala")).toBe("duplicate");
    expect(store.seeds).toEqual(["Tame Impala"]);
  });

  it("ignores an empty name", () => {
    const store = useSeedsStore();
    expect(store.add("   ")).toBe("empty");
    expect(store.seeds).toEqual([]);
  });

  it("holds at most three seeds and is ready from one", () => {
    const store = useSeedsStore();
    expect([MIN_SEEDS, MAX_SEEDS]).toEqual([1, 3]);
    expect(store.isReady).toBe(false);
    store.add("A");
    expect(store.isReady).toBe(true);
    ["B", "C"].forEach((n) => store.add(n));
    expect(store.isFull).toBe(true);
    expect(store.add("D")).toBe("full");
    expect(store.seeds).toHaveLength(3);
  });

  it("removes a seed", () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroko"].forEach((n) => store.add(n));
    store.remove("Tame Impala");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("replaces a misspelled seed in place", () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroco", "Justin Bieber"].forEach((n) => store.add(n));
    store.replace("Kokoroco", "Kokoroko");
    expect(store.seeds).toEqual(["Tame Impala", "Kokoroko", "Justin Bieber"]);
  });

  it("drops the misspelled seed when the suggestion is already a seed", () => {
    const store = useSeedsStore();
    ["Kokoroko", "Kokoroco"].forEach((n) => store.add(n));
    store.replace("Kokoroco", "Kokoroko");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("keeps the seeds across page reloads", async () => {
    useSeedsStore().add("Tame Impala");
    // useLocalStorage writes on the next tick
    await nextTick();
    setActivePinia(createPinia());
    expect(useSeedsStore().seeds).toEqual(["Tame Impala"]);
  });

  // Real bug: the server renders an empty list (no localStorage) and Pinia hydrates it into the browser
  it("keeps the browser's seeds when the server sent an empty state", () => {
    localStorage.setItem("music-recs:seeds", JSON.stringify(["Tame Impala"]));
    const pinia = createPinia();
    pinia.state.value.seeds = { seeds: [] };
    setActivePinia(pinia);

    expect(useSeedsStore().seeds).toEqual(["Tame Impala"]);
    expect(JSON.parse(localStorage.getItem("music-recs:seeds")!)).toEqual(["Tame Impala"]);
  });

  // The limit used to be 5; the API rejects more than 3
  it("trims seeds saved under the old limit", async () => {
    localStorage.setItem("music-recs:seeds", JSON.stringify(["A", "B", "C", "D", "E"]));
    setActivePinia(createPinia());
    const store = useSeedsStore();
    await nextTick();
    expect(store.seeds).toEqual(["A", "B", "C"]);
  });
});
