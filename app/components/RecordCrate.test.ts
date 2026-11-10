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
const info = (wrapper: Awaited<ReturnType<typeof mountCrate>>) => wrapper.get('[data-testid="record-info"]');
const button = (wrapper: Awaited<ReturnType<typeof mountCrate>>, label: string) =>
  wrapper.findAll("button").find((b) => b.attributes("aria-label") === label)!;

describe("RecordCrate", () => {
  it("starts on the first record with its info under the cover", async () => {
    const wrapper = await mountCrate();
    expect(info(wrapper).get("h3").text()).toBe("Khruangbin");
    expect(info(wrapper).text()).toContain("Khruangbin Hit");
    expect(info(wrapper).text()).toContain("Similar to Tame Impala and Kokoroko");
    expect(wrapper.text()).toContain("1 / 3");
  });

  it("stacks every cover and labels its position", async () => {
    const wrapper = await mountCrate();
    const slides = wrapper.findAll('[aria-roledescription="slide"]');
    expect(slides.map((s) => s.attributes("aria-label"))).toEqual(["1 of 3: Khruangbin", "2 of 3: Pond", "3 of 3: Ezra Collective"]);
    expect(slides[0]!.attributes("aria-current")).toBe("true");
  });

  // A record that isn't inside its cover shows on its own while covers slide past
  it("keeps each record inside its own cover so they move together", async () => {
    const wrapper = await mountCrate();
    const slides = wrapper.findAll('[aria-roledescription="slide"]');
    expect(slides.every((s) => s.find('[data-testid="sleeve-record"]').exists())).toBe(true);
    expect(wrapper.findAll('[data-testid="sleeve-record"]')).toHaveLength(slides.length);
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
    await region.trigger("keydown", { key: "ArrowRight" });
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
    expect(button(wrapper, "Next record").attributes("disabled")).toBeDefined();
  });

  it("selects a side record when its cover is clicked", async () => {
    const wrapper = await mountCrate();
    await wrapper.findAll('[aria-roledescription="slide"]')[2]!.trigger("click");
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
  });

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
    expect(wrapper.emitted("retry")).toEqual([["Ezra Collective"]]);
  });

  // The list arrives before previews; the button waits in place until its preview has loaded
  it("shows a disabled, busy play button while the preview is loading", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards: [card("Pond", { status: "pending" }, null)] } });
    const loading = button(wrapper, "Loading preview of Pond");
    expect(loading.attributes("disabled")).toBeDefined();
    expect(loading.attributes("aria-busy")).toBe("true");
    expect(button(wrapper, "Play preview of Pond")).toBeUndefined();
  });

  it("explores from the selected record", async () => {
    const wrapper = await mountCrate();
    await button(wrapper, "Next record").trigger("click");
    await button(wrapper, "Explore artists like Pond").trigger("click");
    expect(wrapper.emitted("explore")).toEqual([["Pond"]]);
  });

  it("hides Explore when it cannot go any deeper", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, canExplore: false } });
    expect(button(wrapper, "Explore artists like Khruangbin")).toBeUndefined();
    expect(wrapper.text()).not.toContain("Explore from here");
  });

  it("starts on the given record and reports where the visitor moves", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, index: 2 } });
    expect(info(wrapper).get("h3").text()).toBe("Ezra Collective");
    await button(wrapper, "Previous record").trigger("click");
    expect(wrapper.emitted("update:index")).toEqual([[1]]);
  });

  it("shows that it is finding more while exploring", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, exploring: true } });
    const explore = button(wrapper, "Explore artists like Khruangbin");
    expect(explore.text()).toBe("Finding more…");
    expect(explore.attributes("disabled")).toBeDefined();
  });

  it("puts previous, play and next in one row", async () => {
    const wrapper = await mountCrate();
    const labels = wrapper.get('[data-testid="controls"]').findAll("button").map((b) => b.attributes("aria-label"));
    expect(labels).toEqual(["Previous record", "Play preview of Khruangbin Hit", "Next record"]);
  });

  it("keeps the arrows around the no-preview message", async () => {
    const wrapper = await mountCrate();
    await button(wrapper, "Next record").trigger("click");
    const controls = wrapper.get('[data-testid="controls"]');
    expect(controls.text()).toContain("No preview");
    expect(controls.findAll("button").map((b) => b.attributes("aria-label"))).toEqual(["Previous record", "Next record"]);
  });

  it("shows the position in small text at the very bottom", async () => {
    const wrapper = await mountCrate();
    const position = wrapper.get('[data-testid="position"]');
    expect(position.text()).toBe("1 / 3");
    expect(position.classes()).toContain("text-xs");
    const explore = button(wrapper, "Explore artists like Khruangbin").element;
    expect(explore.compareDocumentPosition(position.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a notice in place of Explore", async () => {
    const wrapper = await mountSuspended(RecordCrate, { props: { cards, notice: "No new artists here — try another record" } });
    expect(wrapper.text()).toContain("No new artists here — try another record");
    expect(button(wrapper, "Explore artists like Khruangbin")).toBeUndefined();
  });
});
