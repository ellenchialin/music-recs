import { waitForHydration } from "../helpers/browser";
import { expect, test } from "./fixtures";

// The seed gives later records more listeners, so Mainstream moves the last one to the front
test("re-ranks the records for a popularity setting and keeps it in the URL", async ({ page }) => {
  await page.goto("/recommendations?seed=Radiohead");
  await waitForHydration(page);
  const last = (await page.getByRole("group", { name: /^10 of 10: / }).getAttribute("aria-label"))!.replace("10 of 10: ", "");
  const popularity = page.getByRole("group", { name: "Popularity" });
  await expect(popularity.getByRole("radio", { name: "Balanced" })).toBeChecked();

  await popularity.getByText("Mainstream").click();

  await expect(page).toHaveURL("/recommendations?seed=Radiohead&popularity=mainstream");
  await expect(page.getByRole("group", { name: `1 of 10: ${last}`, exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fit your taste? →" })).toHaveAttribute(
    "href",
    "/taste-check?seed=Radiohead&popularity=mainstream",
  );

  // A shared link opens with the same setting and list
  await page.reload();
  await expect(popularity.getByRole("radio", { name: "Mainstream" })).toBeChecked();
  await expect(page.getByRole("group", { name: `1 of 10: ${last}`, exact: true })).toBeVisible();
});
