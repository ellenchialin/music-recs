import { mountSuspended } from "@nuxt/test-utils/runtime";
import { describe, expect, it } from "vitest";
import IndexPage from "./index.vue";

describe("index page", () => {
  it("shows the app title", async () => {
    const page = await mountSuspended(IndexPage);
    expect(page.text()).toContain("Music Recs");
  });
});
