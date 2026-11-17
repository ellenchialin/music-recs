import { addArtist, previewPlayedTo } from "../helpers/browser";
import { expect, test } from "./fixtures";

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
