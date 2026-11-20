import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it, vi } from "vitest";
import CollapsibleSection from "./CollapsibleSection.vue";

const mount = () =>
  mountSuspended(CollapsibleSection, { props: { title: "How it's measured" }, slots: { default: () => "The details" } });

describe("CollapsibleSection", () => {
  it("shows only its title until opened", async () => {
    const box = await mount();

    const button = box.get("h2 button");
    expect(button.text()).toBe("How it's measured");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(box.text()).not.toContain("The details");
  });

  it("opens with its button, showing the content it controls", async () => {
    const box = await mount();

    await box.get("button").trigger("click");

    const button = box.get("button");
    expect(button.attributes("aria-expanded")).toBe("true");
    const region = box.get(`#${button.attributes("aria-controls")}`);
    expect(region.text()).toBe("The details");
  });

  it("closes again with the same button", async () => {
    const box = await mount();
    await box.get("button").trigger("click");

    await box.get("button").trigger("click");

    expect(box.get("button").attributes("aria-expanded")).toBe("false");
    await vi.waitFor(() => expect(box.text()).not.toContain("The details"));
  });

  it("uses the heading level it's given", async () => {
    const box = await mountSuspended(CollapsibleSection, { props: { title: "More", level: 3 } });

    expect(box.find("h3 button").exists()).toBe(true);
  });
});
