import { previewPlayedTo, waitForHydration } from "../helpers/browser";
import { expect, test } from "./fixtures";

test("plays a blind round, rates it and reveals which songs were picked", async ({ page }) => {
  await page.goto("/recommendations?seed=Radiohead");
  await page.getByRole("link", { name: "Fit your taste? →" }).click();
  await expect(page).toHaveURL("/taste-check?seed=Radiohead");
  await waitForHydration(page);

  await page.getByRole("button", { name: "Start" }).click();

  const songs = page.getByTestId("check-song");
  await expect(songs).toHaveCount(3);
  const reveal = page.getByRole("button", { name: "Reveal" });
  await expect(reveal).toBeDisabled();

  await page.getByRole("button", { name: "Play song 1" }).click();
  await expect(page.getByRole("button", { name: "Pause song 1" })).toBeVisible();
  await expect.poll(() => previewPlayedTo(page)).toBeGreaterThan(0);

  for (const n of [1, 2, 3]) {
    await page.getByRole("group", { name: `Rate song ${n} from 1 to 5` }).getByText("4", { exact: true }).click();
  }
  await reveal.click();

  // Names and labels only arrive with the reveal
  await expect(page.getByLabel("You rated it 4 out of 5")).toHaveCount(3);
  await expect(songs.filter({ hasText: "Picked for you" })).not.toHaveCount(0);
  await expect(songs.filter({ hasText: "Random pick" })).not.toHaveCount(0);
  // Random picks come from the seeded genre chart, never from the recommendations
  await expect(songs.filter({ hasText: "Random pick" }).filter({ hasNotText: "Chart Artist" })).toHaveCount(0);
  // Every song got the same score, so the averages tie
  await expect(page.getByText(/songs picked for them averaged 4\.0 out of 5, random picks 4\.0\. Too close to call/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Play another round" })).toBeVisible();
});
