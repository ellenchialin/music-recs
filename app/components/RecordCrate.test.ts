import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecommendationCard } from "~~/shared/types/recommendations";
import RecordCrate from "./RecordCrate.vue";

vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
afterEach(() => usePreviewPlayer().stop());

const card = (artist: string, preview: RecommendationCard["preview"], track: RecommendationCard["track"] = null): RecommendationCard => ({
  artist,
  score: 0.2,
  sources: ["Tame Impala", "Kokoroko"],
  track: track ?? { title: `${artist} Hit`, artworkUrl: `https://art.example/${artist}.jpg` },
  preview,
});

const cards = [
  card("Khruangbin", { status: "available", url: "https://audio.example/khruangbin.m4a" }),
  card("Pond", { status: "unavailable" }, { title: "Paint Me Silver", artworkUrl: null }),
  card("Ezra Collective", { status: "error" }),
];

const mountCrate = () => mountSuspended(RecordCrate, { props: { cards } });
// 目前選到的那張唱片的資訊（封面下方）
const info = (wrapper: Awaited<ReturnType<typeof mountCrate>>) => wrapper.get('[data-testid="record-info"]');
const button = (wrapper: Awaited<ReturnType<typeof mountCrate>>, label: string) =>
  wrapper.findAll("button").find((b) => b.attributes("aria-label") === label)!;

describe("RecordCrate", () => {
  // 一開始選第一張；封面下方是歌手、歌名、和哪些種子相似，還有位置
  it("starts on the first record with its info under the cover", async () => {
    const wrapper = await mountCrate();
    expect(info(wrapper).get("h3").text()).toBe("Khruangbin");
    expect(info(wrapper).text()).toContain("Khruangbin Hit");
    expect(info(wrapper).text()).toContain("Similar to Tame Impala and Kokoroko");
    expect(wrapper.text()).toContain("1 / 3");
  });

  // 每張封面都在（左右堆疊），螢幕閱讀器知道是第幾張
  it("stacks every cover and labels its position", async () => {
    const wrapper = await mountCrate();
    const slides = wrapper.findAll('[aria-roledescription="slide"]');
    expect(slides.map((s) => s.attributes("aria-label"))).toEqual(["1 of 3: Khruangbin", "2 of 3: Pond", "3 of 3: Ezra Collective"]);
    expect(slides[0]!.attributes("aria-current")).toBe("true");
  });

  it("moves to the next and previous record with the arrow buttons", async () => {
    const wrapper = await mountCrate();
    expect(button(wrapper, "Previous record").attributes("disabled")).toBeDefined();
    await button(wrapper, "Next record").trigger("click");
    expect(info(wrapper).get("h3").text()).toBe("Pond");
    expect(wrapper.text()).toContain("2 / 3");
    await button(wrapper, "Previous record").trigger("click");
    expect(info(wrapper).get("h3").text()).toBe("Khruangbin");
  });

  it("moves with the left and right arrow keys", async () => {
    const wrapper = await mountCrate();
    const region = wrapper.get('[aria-roledescription="carousel"]');
    await region.trigger("keydown", { key: "ArrowRight" });
    await region.trigger("keydown", { key: "ArrowRight" });
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
    // 最後一張再往右不動
    await region.trigger("keydown", { key: "ArrowRight" });
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
    expect(button(wrapper, "Next record").attributes("disabled")).toBeDefined();
  });

  // 點旁邊露出來的封面，直接跳到那一張
  it("selects a side record when its cover is clicked", async () => {
    const wrapper = await mountCrate();
    await wrapper.findAll('[aria-roledescription="slide"]')[2]!.trigger("click");
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
  });

  // 播放鍵是圓的，按了播目前這張的試聽
  it("plays the selected record's preview with the round play button", async () => {
    const wrapper = await mountCrate();
    const play = button(wrapper, "Play preview of Khruangbin Hit");
    expect(play.classes()).toContain("rounded-full");
    await play.trigger("click");
    expect(usePreviewPlayer().playingUrl.value).toBe("https://audio.example/khruangbin.m4a");
    expect(button(wrapper, "Pause preview of Khruangbin Hit").attributes("aria-pressed")).toBe("true");
  });

  it("offers Apple Music when the selected record has no preview", async () => {
    const wrapper = await mountCrate();
    await button(wrapper, "Next record").trigger("click");
    expect(info(wrapper).text()).toContain("No preview");
    expect(info(wrapper).get("a").attributes("href")).toBe("https://music.apple.com/tw/search?term=Pond%20Paint%20Me%20Silver");
  });

  it("lets the visitor retry when the preview failed to load", async () => {
    const wrapper = await mountCrate();
    await button(wrapper, "Next record").trigger("click");
    await button(wrapper, "Next record").trigger("click");
    expect(info(wrapper).text()).toContain("Preview failed to load");
    await info(wrapper).findAll("button").find((b) => b.text() === "Retry")!.trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  // Explore from here：以目前這張的歌手為種子往下挖
  it("explores from the selected record", async () => {
    const wrapper = await mountCrate();
    await button(wrapper, "Next record").trigger("click");
    await button(wrapper, "Explore artists like Pond").trigger("click");
    expect(wrapper.emitted("explore")).toEqual([["Pond"]]);
  });

  // 已經挖到最深：不顯示 Explore（停用的按鈕只會多一個要理解的東西；想換方向可以點上方的路徑回去）
  it("hides Explore when it cannot go any deeper", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, canExplore: false } });
    expect(button(wrapper, "Explore artists like Khruangbin")).toBeUndefined();
    expect(wrapper.text()).not.toContain("Explore from here");
  });

  // 回到上一層時，停在當時看的那張：目前第幾張由外面用 v-model:index 帶進來、帶出去
  it("starts on the given record and reports where the visitor moves", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, index: 2 } });
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
    await button(wrapper, "Previous record").trigger("click");
    expect(wrapper.emitted("update:index")).toEqual([[1]]);
  });

  // 往下挖第一次要打 Last.fm、iTunes，可能要好幾秒：按鈕顯示正在找，並且不能連按
  it("shows that it is finding more while exploring", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, exploring: true } });
    const explore = button(wrapper, "Explore artists like Khruangbin");
    expect(explore.text()).toBe("Finding more…");
    expect(explore.attributes("disabled")).toBeDefined();
  });
});
