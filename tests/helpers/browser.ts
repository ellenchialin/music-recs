import { expect, type BrowserContext, type Page } from "@playwright/test";

// Browser-side helpers shared by the E2E tests (fake outside world) and the smoke test (live site)

declare global {
  interface Window {
    // Furthest point any preview has played to, in seconds
    previewPlayedTo?: number;
  }
}

// The player's <audio> is never added to the page, so record its progress from the prototype
export async function recordPreviewProgress(context: BrowserContext) {
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
}

export function previewPlayedTo(page: Page) {
  return page.evaluate(() => window.previewPlayedTo ?? 0);
}

// Typing before Vue has hydrated the page is lost, so retry until the artist shows up
export async function addArtist(page: Page, name: string) {
  const input = page.getByRole("combobox", { name: "Add an artist you love" });
  await expect(async () => {
    await input.fill(name);
    await input.press("Enter");
    await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible({ timeout: 1000 });
  }).toPass();
}
