import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import IndexPage from "./index.vue";

// 首頁只負責選種子：推薦結果在 /recommendations（app/pages/recommendations.test.ts）

beforeEach(() => {
  localStorage.clear();
  useSeedsStore().seeds = [];
});

type Page = Awaited<ReturnType<typeof mountSuspended<typeof IndexPage>>>;
const recommendButton = (wrapper: Page) => wrapper.findAll("button").find((b) => b.text().includes("Recommend"))!;

// 測試之間共用同一個 router，每個測試結束就卸載頁面
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
  it("shows the app title", async () => {
    const page = await open();
    expect(page.get("h1").text()).toContain("Music Recs");
  });

  // 黑膠唱盤一直在太陽圓上；加入的歌手是唱盤下方的標籤，不會蓋住或換掉唱盤
  // 沒有歌手時標籤區是空的，不放提示文字（高度照樣留著，加第一位時版面不跳）
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

  // 至少 1 位種子才能推薦
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

  // 按 Recommend：換到推薦頁，種子放在網址裡
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
  });

  // 從推薦頁的麵包屑回來（/?seed=…）：輸入框換成那組種子，可以接著改；網址清回 /
  it("takes the seeds from the URL when coming back from recommendations", async () => {
    useSeedsStore().add("Radiohead");
    await open("/?seed=Tame+Impala&seed=Kokoroko");
    await vi.waitFor(() => expect(useSeedsStore().seeds).toEqual(["Tame Impala", "Kokoroko"]));
    await vi.waitFor(() => expect(useRouter().currentRoute.value.fullPath).toBe("/"));
  });
});
