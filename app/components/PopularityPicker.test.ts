import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import PopularityPicker from "./PopularityPicker.vue";

describe("PopularityPicker", () => {
  it("offers the three settings as one named group, with the current one chosen", async () => {
    const picker = await mountSuspended(PopularityPicker, { props: { modelValue: "balanced" } });

    expect(picker.get("fieldset legend").text()).toBe("Popularity");
    const inputs = picker.findAll('input[type="radio"]');
    expect(inputs.map((i) => i.attributes("value"))).toEqual(["obscure", "balanced", "mainstream"]);
    expect(picker.findAll("label").map((l) => l.text())).toEqual(["Obscure", "Balanced", "Mainstream"]);
    expect(inputs.map((i) => (i.element as HTMLInputElement).checked)).toEqual([false, true, false]);
  });

  it("reports the setting the visitor picks", async () => {
    const picker = await mountSuspended(PopularityPicker, { props: { modelValue: "balanced" } });

    await picker.get('input[value="mainstream"]').setValue(true);

    expect(picker.emitted("update:modelValue")).toEqual([["mainstream"]]);
  });

  it("says when the list is being re-sorted", async () => {
    const picker = await mountSuspended(PopularityPicker, { props: { modelValue: "obscure", busy: true } });

    expect(picker.get("fieldset").attributes("aria-busy")).toBe("true");
  });
});
