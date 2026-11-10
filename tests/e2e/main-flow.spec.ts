import { expect, test } from "@playwright/test";
import { PREVIEW_ORIGIN, silentWav } from "./outside-world";

const wav = silentWav();

declare global {
  interface Window {
    // Furthest point any preview has played to, in seconds
    previewPlayedTo?: number;
  }
}

test.beforeEach(async ({ context }) => {
  // Nothing may reach the real outside world: previews get a WAV, everything else is blocked
  await context.route(
    (url) => url.hostname !== "localhost",
    (route) =>
      route.request().url().startsWith(PREVIEW_ORIGIN)
        ? route.fulfill({ contentType: "audio/wav", body: wav })
        : route.abort(),
  );

  // The player's <audio> is never added to the page, so record its progress from the prototype
  await context.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    // The page reuses one element, so listen only once per element
    const watched = new WeakSet<HTMLMediaElement>();
    HTMLMediaElement.prototype.play = function () {
      if (!watched.has(this)) {
        watched.add(this);
        this.addEventListener("timeupdate", () => {
          window.previewPlayedTo = Math.max(window.previewPlayedTo ?? 0, this.currentTime);
        });
      }
      return play.call(this);
    };
  });
});

test("picks an artist, gets recommendations and hears a preview", async ({ page }) => {
  // Typing would trigger autocomplete, which calls Last.fm; SeedInput's component tests cover it
  await page.route("**/api/artists/search**", (route) => route.fulfill({ json: [] }));

  await page.goto("/");
  const input = page.getByRole("combobox", { name: "Add an artist you love" });
  // Typing before Vue has hydrated the page is lost, so retry until the artist shows up
  await expect(async () => {
    await input.fill("Radiohead");
    await input.press("Enter");
    await expect(page.getByRole("button", { name: "Remove Radiohead" })).toBeVisible({ timeout: 1000 });
  }).toPass();

  await page.getByRole("button", { name: "Recommend" }).click();

  await expect(page).toHaveURL(/\/recommendations\?seed=Radiohead$/);
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByRole("group", { name: /^1 of 10: / })).toBeVisible();
  await expect(page.getByText("Similar to Radiohead")).toBeVisible();

  await page.getByRole("button", { name: /^Play preview of / }).click();

  await expect(page.getByRole("button", { name: /^Pause preview of / })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.previewPlayedTo ?? 0)).toBeGreaterThan(0);
});
