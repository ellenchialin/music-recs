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

  // 和後端同一套正規化規則：大小寫、空白不同也算同一位
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

  // 種子 1–3 位（docs/ai-log.md：原本 SPEC 是 3–5 位）
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

  // 404 時前端建議「你是不是要找 Kokoroko」，點了就換掉打錯的那位，位置不變
  it("replaces a misspelled seed in place", () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroco", "Justin Bieber"].forEach((n) => store.add(n));
    store.replace("Kokoroco", "Kokoroko");
    expect(store.seeds).toEqual(["Tame Impala", "Kokoroko", "Justin Bieber"]);
  });

  // 建議的名字已經在清單裡：只拿掉打錯的那位，不要重複
  it("drops the misspelled seed when the suggestion is already a seed", () => {
    const store = useSeedsStore();
    ["Kokoroko", "Kokoroco"].forEach((n) => store.add(n));
    store.replace("Kokoroco", "Kokoroko");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  // SPEC：種子同步到 localStorage，重新整理頁面還在
  it("keeps the seeds across page reloads", async () => {
    useSeedsStore().add("Tame Impala");
    // useLocalStorage 在下一個 tick 才寫進 localStorage（和 Vue 的 watch 一樣）
    await nextTick();
    setActivePinia(createPinia());
    expect(useSeedsStore().seeds).toEqual(["Tame Impala"]);
  });

  // 真實情況：伺服器端沒有 localStorage，渲染出空清單；Pinia 把這份空狀態帶到瀏覽器（SSR hydration）。
  // 不能讓它蓋掉瀏覽器 localStorage 裡的種子，否則重新整理後種子全不見
  it("keeps the browser's seeds when the server sent an empty state", () => {
    localStorage.setItem("music-recs:seeds", JSON.stringify(["Tame Impala"]));
    const pinia = createPinia();
    pinia.state.value.seeds = { seeds: [] };
    setActivePinia(pinia);

    expect(useSeedsStore().seeds).toEqual(["Tame Impala"]);
    expect(JSON.parse(localStorage.getItem("music-recs:seeds")!)).toEqual(["Tame Impala"]);
  });

  // 以前最多可以選 5 位；舊的 localStorage 讀進來時只留前 3 位，不然 API 會回 400
  it("trims seeds saved under the old limit", async () => {
    localStorage.setItem("music-recs:seeds", JSON.stringify(["A", "B", "C", "D", "E"]));
    setActivePinia(createPinia());
    const store = useSeedsStore();
    await nextTick();
    expect(store.seeds).toEqual(["A", "B", "C"]);
  });
});
