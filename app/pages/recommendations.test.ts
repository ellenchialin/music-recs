import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecommendationsResult } from "~~/shared/types/recommendations";
import RecommendationsPage from "./recommendations.vue";

// 假的推薦 API：種子裡有 Kokoroco（拼錯）就回 404。
// 使用者選的種子 → Khruangbin、Pond；Explore 往下挖（有 exclude）→「<種子> Friend 1」「<種子> Friend 2」；
// 種子是 Nowhere → 沒有新歌手。每次請求的 seed 和 exclude 都記下來
let requests: { seeds: string[]; exclude: string[] }[] = [];
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
  const query = new URLSearchParams(event.path.split("?")[1]);
  const seeds = query.getAll("seed");
  const exclude = query.getAll("exclude");
  requests.push({ seeds, exclude });
  if (seeds.includes("Kokoroco")) {
    throw createError({ statusCode: 404, data: { seed: "Kokoroco", suggestions: ["Kokoroko", "LocoRoco"] } });
  }
  const seed = seeds[0]!;
  const artists = !exclude.length ? ["Khruangbin", "Nowhere"] : seed === "Nowhere" ? [] : [`${seed} Friend 1`, `${seed} Friend 2`];
  const result: RecommendationsResult = { algoVersion: "v2", seeds, recommendations: artists.map(card) };
  return result;
});

beforeEach(() => {
  requests = [];
  gate = null;
  // 每個測試從乾淨的狀態開始：查過的層存在 useState，useAsyncData 的結果也會依 key 留在 Nuxt app 裡
  clearNuxtState();
  clearNuxtData();
  Element.prototype.scrollIntoView = vi.fn();
});

// 測試之間共用同一個 router：上一個測試掛著的頁面還會跟著網址變化去查詢，每個測試結束就卸載
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
// Vue Router 把網址裡的空白寫成「+」，比對解析後的 query 比較不受編碼影響
const currentQuery = () => useRouter().currentRoute.value.query;
const SEEDS_QUERY = { seed: ["Tame Impala", "Kokoroko"] };

describe("recommendations page", () => {
  // 網址就是推薦的來源：種子從 query 來
  it("recommends from the seeds in the URL", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toEqual(["Khruangbin", "Nowhere"]));
    expect(heading(page)).toBe("Recommended for you");
    expect(requests).toEqual([{ seeds: ["Tame Impala", "Kokoroko"], exclude: [] }]);
  });

  // 麵包屑：Home 帶著種子回首頁，可以接著改種子
  it("links home with the seeds so they can be changed", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(crumbs(page)).toEqual(["Home", "Tame Impala + Kokoroko"]));
    expect(crumbLink(page, "Home").attributes("href")).toBe("/?seed=Tame+Impala&seed=Kokoroko");
  });

  // 往下挖：網址多一層 explore，標題、麵包屑、唱片跟著變；排除原本的種子和看過的唱片
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

  // 分享或重新整理往下挖過的網址：每一層依序查回來，停在最深那層
  it("opens a shared link that explored a level", async () => {
    const page = await open(`${SEEDS}&explore=Khruangbin`);
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin"));
    expect(requests).toEqual([
      { seeds: ["Tame Impala", "Kokoroko"], exclude: [] },
      { seeds: ["Khruangbin"], exclude: ["Tame Impala", "Kokoroko", "Khruangbin", "Nowhere"] },
    ]);
  });

  // 點麵包屑回上一層：不重新查詢，停在當時看的那張
  it("goes back along the breadcrumb without reloading", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    await button(page, "Next record")!.trigger("click");
    await button(page, "Previous record")!.trigger("click");
    await button(page, "Explore artists like Khruangbin")!.trigger("click");
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin"));
    const calls = requests.length;

    // happy-dom 裡點 <a> 不會觸發 router 換頁：確認連結的網址，再用 router 走過去（瀏覽器裡另外實測點擊）
    const href = crumbLink(page, "Tame Impala + Kokoroko").attributes("href")!;
    expect(href).toBe("/recommendations?seed=Tame+Impala&seed=Kokoroko");
    await useRouter().push(href);

    await vi.waitFor(() => expect(heading(page)).toBe("Recommended for you"));
    expect(currentQuery()).toEqual(SEEDS_QUERY);
    expect(requests).toHaveLength(calls);
  });

  // 最多往下挖 3 層：第 3 層不顯示 Explore
  it("hides Explore three levels deep", async () => {
    const page = await open(`${SEEDS}&explore=Khruangbin&explore=Khruangbin%20Friend%201&explore=Khruangbin%20Friend%201%20Friend%201`);
    await vi.waitFor(() => expect(heading(page)).toBe("More like Khruangbin Friend 1 Friend 1"));
    expect(page.text()).not.toContain("Explore from here");
  });

  // 往下挖沒有新歌手：停在原層、網址不變，告訴使用者換一張試試
  it("stays put when there is nothing new to explore", async () => {
    const page = await open(SEEDS);
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
    await button(page, "Next record")!.trigger("click");
    await button(page, "Explore artists like Nowhere")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).toContain("No new artists here — try another record"));
    expect(currentQuery()).toEqual(SEEDS_QUERY);
    // 換到別張唱片，提示就收起來，Explore 回來
    await button(page, "Previous record")!.trigger("click");
    await vi.waitFor(() => expect(page.text()).not.toContain("No new artists here"));
    expect(button(page, "Explore artists like Khruangbin")).toBeDefined();
  });

  // 種子找不到：建議的名字點了就換掉網址裡那位
  it("suggests a fix when a seed is not found", async () => {
    const page = await open("/recommendations?seed=Tame%20Impala&seed=Kokoroco");
    await vi.waitFor(() => expect(page.text()).toContain('Can\'t find "Kokoroco"'));

    await page.findAll("button").find((b) => b.text() === "Kokoroko")!.trigger("click");

    await vi.waitFor(() => expect(currentQuery()).toEqual(SEEDS_QUERY));
  });

  // 網址沒有種子：請使用者回首頁選
  it("asks for an artist when the URL has no seeds", async () => {
    const page = await open("/recommendations");
    expect(page.text()).toContain("Pick an artist first");
    expect(page.find('a[href="/"]').exists()).toBe(true);
  });

  // 查詢中：置中的唱盤（螢幕閱讀器念「Finding recommendations」）
  it("shows the turntable while loading", async () => {
    let release!: () => void;
    gate = new Promise((r) => (release = r));
    const page = await open(SEEDS);
    expect(page.find('[role="status"]').text()).toContain("Finding recommendations");
    expect(page.find('[data-testid="vinyl-record"]').exists()).toBe(true);
    release();
    await vi.waitFor(() => expect(recordNames(page)).toHaveLength(2));
  });
});
