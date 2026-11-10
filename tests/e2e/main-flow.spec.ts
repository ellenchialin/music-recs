import { expect, test } from "@playwright/test";
import { addArtist, previewPlayedTo, recordPreviewProgress } from "../helpers/browser";
import { PREVIEW_ORIGIN, silentWav } from "./outside-world";

const wav = silentWav();

test.beforeEach(async ({ context }) => {
  // Nothing may reach the real outside world: previews get a WAV, everything else is blocked
  await context.route(
    (url) => url.hostname !== "localhost",
    (route) =>
      route.request().url().startsWith(PREVIEW_ORIGIN)
        ? route.fulfill({ contentType: "audio/wav", body: wav })
        : route.abort(),
  );
  await recordPreviewProgress(context);
});

test("picks an artist, gets recommendations and hears a preview", async ({ page }) => {
  // Typing would trigger autocomplete, which calls Last.fm; SeedInput's component tests cover it
  await page.route("**/api/artists/search**", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  await addArtist(page, "Radiohead");
  await page.getByRole("button", { name: "Recommend" }).click();

  await expect(page).toHaveURL(/\/recommendations\?seed=Radiohead$/);
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByRole("group", { name: /^1 of 10: / })).toBeVisible();
  await expect(page.getByText("Similar to Radiohead")).toBeVisible();

  await page.getByRole("button", { name: /^Play preview of / }).click();

  await expect(page.getByRole("button", { name: /^Pause preview of / })).toBeVisible();
  await expect.poll(() => previewPlayedTo(page)).toBeGreaterThan(0);
});
