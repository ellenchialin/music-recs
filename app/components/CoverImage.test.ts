import { mountSuspended } from "@nuxt/test-utils/runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import CoverImage from "./CoverImage.vue";

const mountCover = () => mountSuspended(CoverImage, { props: { src: "https://art.example/cover.jpg" } });

describe("CoverImage", () => {
  afterEach(() => vi.restoreAllMocks());

  // The blurred cover underneath shows until the sharp one can fade in whole
  it("stays hidden until its file has loaded, then shows", async () => {
    const wrapper = await mountCover();
    const img = wrapper.get("img");
    expect(img.attributes("data-loaded")).toBe("false");
    await img.trigger("load");
    expect(img.attributes("data-loaded")).toBe("true");
  });

  // The page is rendered on the server, so the file can finish before Vue listens for load
  it("shows at once when the browser already has the file", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(300);
    const wrapper = await mountCover();
    expect(wrapper.get("img").attributes("data-loaded")).toBe("true");
  });

  it("starts hidden again when given another file", async () => {
    const wrapper = await mountCover();
    await wrapper.get("img").trigger("load");
    await wrapper.setProps({ src: "https://art.example/other.jpg" });
    expect(wrapper.get("img").attributes("data-loaded")).toBe("false");
  });
});
