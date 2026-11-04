import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import type { RecommendationsResult } from "~~/shared/types/recommendations";
import IndexPage from "./index.vue";

// 假的推薦 API：種子裡有 Kokoroco（拼錯）就回 404。
// 使用者選的種子 → Khruangbin、Pond；Explore 往下挖（只有一位種子）→「<種子> Friend 1」「<種子> Friend 2」；
// 種子是 Nowhere → 沒有新歌手。每次請求的 seed 和 exclude 都記下來
let requests: { seeds: string[]; exclude: string[] }[] = [];
// 第一批換成「Nowhere、Pond」：測往下挖找不到新歌手的情況
let returnNowhere = false;
let receivedSeeds: string[] = [];
// 想觀察「推薦中」的狀態時，設定 gate：API 會等到 gate 放行才回應
let gate: Promise<void> | null = null;
const card = (artist: string) => ({
  artist,
  score: 0.2,
  sources: ["Tame Impala"],
  track: { title: `${artist} Hit`, artworkUrl: null },
  preview: { status: "unavailable" as const },
});
registerEndpoint("/api/recommendations", async (event) => {
  if (gate) await gate;
  // 測試環境的 event.path 是相對網址（/api/recommendations?seed=...），h3 的 getQuery 解析不了，自己拆
  const query = new URLSearchParams(event.path.split("?")[1]);
  receivedSeeds = query.getAll("seed");
  requests.push({ seeds: receivedSeeds, exclude: query.getAll("exclude") });
  if (receivedSeeds.includes("Kokoroco")) {
    throw createError({ statusCode: 404, data: { seed: "Kokoroco", suggestions: ["Kokoroko", "LocoRoco"] } });
  }
  const exploring = query.getAll("exclude").length > 0;
  const seed = receivedSeeds[0]!;
  const firstBatch = returnNowhere ? ["Nowhere", "Pond"] : ["Khruangbin", "Pond"];
  const artists = !exploring ? firstBatch : seed === "Nowhere" ? [] : [`${seed} Friend 1`, `${seed} Friend 2`];
  const result: RecommendationsResult = { algoVersion: "v2", seeds: receivedSeeds, recommendations: artists.map(card) };
  return result;
});

const scrollIntoView = vi.fn();

beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
  receivedSeeds = [];
  requests = [];
  returnNowhere = false;
  gate = null;
  // happy-dom 不會真的捲動；換成假的，記錄被捲到哪個元素、用什麼參數
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof IndexPage>>>;
const records = (wrapper: Page) => wrapper.findAll('[aria-roledescription="slide"]');
const recordNames = (wrapper: Page) => records(wrapper).map((r) => r.attributes("aria-label")!.split(": ")[1]);
const button = (wrapper: Page, label: string) => wrapper.findAll("button").find((b) => b.attributes("aria-label") === label);
const heading = (wrapper: Page) => wrapper.get("h2[tabindex]").text();
const trailNames = (wrapper: Page) => wrapper.findAll('nav[aria-label="Exploration path"] li').map((li) => li.text().replace("›", "").trim());
const recommendButton = (wrapper: Page) => wrapper.findAll("button").find((b) => b.text().includes("Recommend"))!;

describe("index page", () => {
  it("shows the app title", async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.get("h1").text()).toContain("Music Recs");
  });

  // 黑膠唱盤一直在太陽圓上；加入的歌手是唱盤下方的標籤，不會蓋住或換掉唱盤
  // 沒有歌手時標籤區是空的，不放提示文字（高度照樣留著，加第一位時版面不跳）
  it("shows no placeholder text before any artist is added", async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.text()).not.toContain("Your artists will appear here");
  });

  it("lists added artists as tags under the record", async () => {
    const page = await mountSuspended(IndexPage);
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

  // 至少 1 位種子才能推薦
  it("asks for a seed before recommending", async () => {
    const page = await mountSuspended(IndexPage);
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
    const page = await mountSuspended(IndexPage);
    await page.get('button[aria-label="Remove Tame Impala"]').trigger("click");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });

  it("shows the recommendations as a crate of records", async () => {
    ["Tame Impala", "Justin Bieber", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(records(page)).toHaveLength(2));
    expect(receivedSeeds).toEqual(["Tame Impala", "Justin Bieber", "Kokoroko"]);
    // 唱片箱：兩張封面，第一張是選到的
    expect(records(page).map((r) => r.attributes("aria-label"))).toEqual(["1 of 2: Khruangbin", "2 of 2: Pond"]);
    expect(page.get('[data-testid="record-info"] h3').text()).toBe("Khruangbin");
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
    expect(page.get('button[aria-label="Remove Tame Impala"]').attributes("disabled")).toBeDefined();

    release();
    await vi.waitFor(() => expect(records(page)).toHaveLength(2));
    expect(page.get("#seed-input").attributes("disabled")).toBeUndefined();
  });

  // 推薦出現後，「推薦給你」要捲到畫面頂端，而不是只捲到剛好看得到
  it("scrolls the results heading to the top of the screen", async () => {
    ["Tame Impala", "Justin Bieber", "Kokoroko"].forEach((n) => useSeedsStore().add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    const target = scrollIntoView.mock.contexts[0] as HTMLElement;
    expect(target.textContent).toContain("Recommended for you");
    expect(scrollIntoView.mock.calls[0]?.[0]).toMatchObject({ block: "start" });
  });

  // 404：說哪一位找不到，點建議的名字就換掉並重新推薦
  it("suggests a fix when a seed is not found", async () => {
    const store = useSeedsStore();
    ["Tame Impala", "Kokoroco", "Justin Bieber"].forEach((n) => store.add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain('Can\'t find "Kokoroco"'));

    await page.findAll("button").find((b) => b.text() === "Kokoroko")!.trigger("click");

    expect(store.seeds).toEqual(["Tame Impala", "Kokoroko", "Justin Bieber"]);
    await vi.waitFor(() => expect(records(page)).toHaveLength(2));
  });

  // 推薦完、開始往下挖之前，不顯示路徑
  async function recommended(seeds = ["Tame Impala", "Kokoroko"]) {
    seeds.forEach((n) => useSeedsStore().add(n));
    const page = await mountSuspended(IndexPage);
    await recommendButton(page).trigger("click");
    await vi.waitFor(() => expect(records(page)).toHaveLength(2));
    return page;
  }

  // Explore from here：以那位歌手為種子，排除原本的種子和看過的唱片；標題和路徑跟著變
  it("explores from a record", async () => {
    const page = await recommended();
    expect(page.find('nav[aria-label="Exploration path"]').exists()).toBe(false);

    await button(page, "Next record")!.trigger("click");
    await button(page, "Explore artists like Pond")!.trigger("click");

    await vi.waitFor(() => expect(heading(page)).toBe("More like Pond"));
    expect(requests.at(-1)).toEqual({ seeds: ["Pond"], exclude: ["Tame Impala", "Kokoroko", "Khruangbin", "Pond"] });
    expect(recordNames(page)).toEqual(["Pond Friend 1", "Pond Friend 2"]);
    expect(trailNames(page)).toEqual(["Your artists", "Pond"]);
  });

  // 點路徑回到上一層：不重新查詢，停在當時看的那張
  it("goes back along the path without reloading", async () => {
    const page = await recommended();
    await button(page, "Next record")!.trigger("click");
    await button(page, "Explore artists like Pond")!.trigger("click");
    await vi.waitFor(() => expect(heading(page)).toBe("More like Pond"));
    const calls = requests.length;

    await page.findAll('nav[aria-label="Exploration path"] button').find((b) => b.text() === "Your artists")!.trigger("click");

    await vi.waitFor(() => expect(heading(page)).toBe("Recommended for you"));
    expect(requests).toHaveLength(calls);
    expect(page.get('[data-testid="record-info"] h3').text()).toBe("Pond");
  });

  // 最多往下挖 3 層，第 3 層不顯示 Explore
  it("stops after exploring three levels deep", async () => {
    const page = await recommended();
    await button(page, "Next record")!.trigger("click");
    for (const artist of ["Pond", "Pond Friend 1", "Pond Friend 1 Friend 1"]) {
      await button(page, `Explore artists like ${artist}`)!.trigger("click");
      await vi.waitFor(() => expect(heading(page)).toBe(`More like ${artist}`));
    }
    expect(trailNames(page)).toEqual(["Your artists", "Pond", "Pond Friend 1", "Pond Friend 1 Friend 1"]);
    expect(button(page, "Explore artists like Pond Friend 1 Friend 1 Friend 1")).toBeUndefined();
  });

  // 往下挖沒有新歌手：停在原本這層，告訴使用者換一張試試
  it("says so when there is nothing new to explore", async () => {
    returnNowhere = true;
    const page = await recommended(["Tame Impala"]);
    await button(page, "Explore artists like Nowhere")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("No new artists here — try another record"));
    expect(heading(page)).toBe("Recommended for you");
  });
});
