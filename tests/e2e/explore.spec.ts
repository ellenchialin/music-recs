import { previewPlayedTo, waitForHydration } from "../helpers/browser";
import { expect, test } from "./fixtures";

// The seed explores from the first record only, so the test does too
test("explores from a record, hears a preview there and goes back up", async ({ page }) => {
  await page.goto("/recommendations?seed=Radiohead");
  await waitForHydration(page);
  const explore = page.getByRole("button", { name: /^Explore artists like / });
  const artist = (await explore.getAttribute("aria-label"))!.replace("Explore artists like ", "");

  await explore.click();

  await expect.poll(() => new URL(page.url()).searchParams.getAll("explore")).toEqual([artist]);
  await expect(page.getByRole("heading", { name: `More like ${artist}` })).toBeVisible();
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(artist);
  await expect(page.getByRole("group", { name: new RegExp(`^1 of 10: ${escape(artist)} Circle`) })).toBeVisible();
  await expect(page.getByText(`Similar to ${artist}`)).toBeVisible();

  await page.getByRole("button", { name: /^Play preview of / }).click();
  await expect.poll(() => previewPlayedTo(page)).toBeGreaterThan(0);

  await breadcrumb.getByRole("link", { name: "Radiohead" }).click();

  await expect(page).toHaveURL("/recommendations?seed=Radiohead");
  await expect(page.getByRole("heading", { name: "Recommended for you" })).toBeVisible();
  await expect(page.getByRole("group", { name: new RegExp(`^1 of 10: ${escape(artist)}$`) })).toBeVisible();
});

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
