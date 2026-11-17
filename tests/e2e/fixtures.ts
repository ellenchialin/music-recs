import { test as base } from "@playwright/test";
import { recordPreviewProgress } from "../helpers/browser";
import { fakeOutsideWorld } from "./outside-world";

// Every E2E test gets a browser that never reaches the outside world and records preview
// progress, without each spec having to remember both
export const test = base.extend<{ outsideWorld: undefined }>({
  outsideWorld: [
    async ({ context }, use) => {
      await fakeOutsideWorld(context);
      await recordPreviewProgress(context);
      await use(undefined);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
