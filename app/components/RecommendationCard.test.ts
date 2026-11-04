import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecommendationCard as Card } from "~~/shared/types/recommendations";
import RecommendationCard from "./RecommendationCard.vue";

vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
afterEach(() => usePreviewPlayer().stop());

const base: Card = {
  artist: "Khruangbin",
  score: 0.27,
  sources: ["Tame Impala", "Kokoroko"],
  track: { title: "Maria También", artworkUrl: "https://art.example/600x600bb.jpg" },
  preview: { status: "available", url: "https://audio.example/khruangbin.m4a" },
};

const mountCard = (card: Partial<Card> = {}) => mountSuspended(RecommendationCard, { props: { card: { ...base, ...card } } });

describe("RecommendationCard", () => {
  it("shows the artist, the track and which seeds it came from", async () => {
    const wrapper = await mountCard();
    expect(wrapper.get("h3").text()).toBe("Khruangbin");
    expect(wrapper.text()).toContain("Maria También");
    expect(wrapper.text()).toContain("和 Tame Impala、Kokoroko 相似");
    expect(wrapper.get("img").attributes("src")).toBe("https://art.example/600x600bb.jpg");
  });

  // 播放鈕：按一下播、再按一下停；aria-pressed 讓螢幕閱讀器知道狀態
  it("plays and pauses the preview", async () => {
    const wrapper = await mountCard();
    const button = wrapper.get("button");
    expect(button.attributes("aria-pressed")).toBe("false");
    await button.trigger("click");
    expect(usePreviewPlayer().playingUrl.value).toBe("https://audio.example/khruangbin.m4a");
    expect(button.attributes("aria-pressed")).toBe("true");
    await button.trigger("click");
    expect(usePreviewPlayer().playingUrl.value).toBeNull();
  });

  // 三個商店都沒有：不顯示播放鈕，給一個到 Apple Music 搜尋的連結
  it("offers an Apple Music search when there is no preview", async () => {
    const wrapper = await mountCard({ preview: { status: "unavailable" }, track: { title: "Maria También", artworkUrl: null } });
    expect(wrapper.find("button").exists()).toBe(false);
    expect(wrapper.text()).toContain("暫無試聽");
    const link = wrapper.get("a");
    expect(link.attributes("href")).toBe("https://music.apple.com/tw/search?term=Khruangbin%20Maria%20Tambi%C3%A9n");
    // 沒有封面時用歌手名字的第一個字當替代
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.text()).toContain("K");
  });

  // iTunes 暫時壞了：顯示可以重試，按了通知頁面重新查詢
  it("lets the visitor retry when the preview failed to load", async () => {
    const wrapper = await mountCard({ preview: { status: "error" }, track: null });
    expect(wrapper.text()).toContain("試聽暫時無法載入");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });
});
