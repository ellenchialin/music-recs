import { mountSuspended, registerEndpoint } from "@nuxt/test-utils/runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSeedsStore } from "~/stores/seeds";
import SeedInput from "./SeedInput.vue";

// 假的自動完成 API：不管打什麼都回這兩位，並記下每次查的字
const searched: string[] = [];
registerEndpoint("/api/artists/search", (event) => {
  searched.push(new URLSearchParams(event.path.split("?")[1]).get("q") ?? "");
  return [
    { name: "Tame Impala", listeners: 3_000_000 },
    { name: "Tame Impala, JENNIE", listeners: 50_000 },
  ];
});

// 元件用的是 Nuxt app 自己的 Pinia（測試之間共用），所以每個測試前把種子清空
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

// 打字後等 debounce 和 API 回來，直到選項出現
async function typeAndWaitForOptions(wrapper: Awaited<ReturnType<typeof mountInput>>["wrapper"], text: string) {
  await wrapper.get("input").setValue(text);
  await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0), { timeout: 2000 });
}

describe("SeedInput", () => {
  // 自動完成找不到也沒關係：Enter 直接加打的字，後端的 autocorrect 會修正
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

  // 鍵盤也能選：↓ 移到第一個建議，Enter 加入
  it("adds the highlighted suggestion with the arrow keys and Enter", async () => {
    const { wrapper, input, store } = await mountInput();
    await typeAndWaitForOptions(wrapper, "tame");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.findAll('[role="option"]')[0]!.attributes("aria-selected")).toBe("true");
    await input.trigger("keydown", { key: "Enter" });
    expect(store.seeds).toEqual(["Tame Impala"]);
  });

  // 一般打字速度（每個字間隔約 150–300ms）不該每停一下就查一次：只在停下來之後查最後打的字
  it("searches once for words typed at a normal pace", async () => {
    const { wrapper, input } = await mountInput();
    for (const text of ["d", "da", "dan", "dani", "danie", "daniel", "daniel c", "daniel ca"]) {
      await input.setValue(text);
      await wait(250);
    }
    await vi.waitFor(() => expect(wrapper.findAll('[role="option"]').length).toBeGreaterThan(0), { timeout: 2000 });
    expect(searched).toEqual(["daniel ca"]);
  });

  // 刪掉幾個字再打回來，查過的字不再打 API
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
    expect(wrapper.text()).toContain("已經加過");
    expect(store.seeds).toEqual(["Kokoroko"]);
  });
});
