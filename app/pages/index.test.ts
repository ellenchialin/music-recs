import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { RecommendationsResult } from "~~/shared/types/recommendations";
import IndexPage from "./index.vue";

// 假的推薦 API：種子裡有 Kokoroco（拼錯）就回 404，否則回兩張卡片，並記下收到的種子
let receivedSeeds: string[] = [];
// 想觀察「推薦中」的狀態時，設定 gate：API 會等到 gate 放行才回應
let gate: Promise<void> | null = null;
registerEndpoint("/api/recommendations", async (event) => {
  if (gate) await gate;
  // 測試環境的 event.path 是相對網址（/api/recommendations?seed=...），h3 的 getQuery 解析不了，自己拆
  receivedSeeds = new URLSearchParams(event.path.split("?")[1]).getAll("seed");
  if (receivedSeeds.includes("Kokoroco")) {
    throw createError({ statusCode: 404, data: { seed: "Kokoroco", suggestions: ["Kokoroko", "LocoRoco"] } });
  }
  const result: RecommendationsResult = {
    algoVersion: "v2",
    seeds: receivedSeeds,
    recommendations: [
      {
        artist: "Khruangbin",
        score: 0.27,
        sources: ["Tame Impala", "Kokoroko"],
        track: { title: "Maria También", artworkUrl: null },
        preview: { status: "unavailable" },
      },
      {
        artist: "Pond",
        score: 0.17,
        sources: ["Tame Impala"],
        track: { title: "Paint Me Silver", artworkUrl: null },
        preview: { status: "unavailable" },
      },
    ],
  };
  return result;
});

const scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
  receivedSeeds = [];
  gate = null;
  // happy-dom 不會真的捲動；換成假的，記錄被捲到哪個元素、用什麼參數
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof IndexPage>>>;
const recommendButton = (wrapper: Page) => wrapper.findAll("button").find((b) => b.text().includes("推薦給我"))!;

describe("index page", () => {
  it("shows the app title", async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.get("h1").text()).toContain("Music Recs");
  });

  // 還沒有種子時，太陽圓上是音浪動畫；螢幕閱讀器念「還沒有選歌手」
  it("shows a sound wave until the first seed is added", async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.find('[role="img"][aria-label="還沒有選歌手"]').exists()).toBe(true);
    useSeedsStore().add("Tame Impala");
    await nextTick();
    expect(page.find('[role="img"][aria-label="還沒有選歌手"]').exists()).toBe(false);
  });

  // 至少 1 位種子才能推薦
  it("asks for a seed before recommending", async () => {
    const page = await mountSuspended(IndexPage);
    expect(recommendButton(page).attributes("disabled")).toBeDefined();
    expect(page.text()).toContain("先選 1 位歌手");
    useSeedsStore().add("Tame Impala");
    await nextTick();
    expect(recommendButton(page).attributes("disabled")).toBeUndefined();
    expect(page.text()).not.toContain("先選 1 位歌手");
  });

  it("removes a seed from the list", async () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroko"].forEach((n) => store.add(n));
    const page = await mountSuspended(IndexPage);
    await page.get('button[aria-label="移除 Tame Impala"]').trigger("click");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("shows a card for each recommendation", async () => {
    ["Tame Impala", "Justin Bieber", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(page.findAll("article")).toHaveLength(2));
    expect(receivedSeeds).toEqual(["Tame Impala", "Justin Bieber", "Kokoroko"]);
    expect(page.findAll("article h3").map((h) => h.text())).toEqual(["Khruangbin", "Pond"]);
  });

  // 推薦中不能改種子：查詢用的是按下按鈕那一刻的種子，中途改了結果會對不上
  it("locks the input and the seed list while recommending", async () => {
    // 2 位就好：選滿 3 位時輸入框本來就停用，分不出是不是「推薦中」造成的
    ["Tame Impala", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const page = await mountSuspended(IndexPage);

    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(page.get("#seed-input").attributes("disabled")).toBeDefined());
    expect(page.get('button[aria-label="移除 Tame Impala"]').attributes("disabled")).toBeDefined();

    release();
    await vi.waitFor(() => expect(page.findAll("article")).toHaveLength(2));
    expect(page.get("#seed-input").attributes("disabled")).toBeUndefined();
  });

  // 推薦出現後，「推薦給你」要捲到畫面頂端，而不是只捲到剛好看得到
  it("scrolls the results heading to the top of the screen", async () => {
    ["Tame Impala", "Justin Bieber", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    const target = scrollIntoView.mock.contexts[0] as HTMLElement;
    expect(target.textContent).toContain("推薦給你");
    expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({ block: "start" });
  });

  // 404：說哪一位找不到，點建議的名字就換掉並重新推薦
  it("suggests a fix when a seed is not found", async () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroco", "Justin Bieber"].forEach((n) => store.add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("找不到「Kokoroco」"));

    await page.findAll("button").find((b) => b.text() === "Kokoroko")!.trigger("click");

    expect(store.seeds).toEqual(["Tame Impala", "Kokoroko", "Justin Bieber"]);
    await vi.waitFor(() => expect(page.findAll("article")).toHaveLength(2));
  });
});
