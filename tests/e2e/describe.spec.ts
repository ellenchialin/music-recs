import { waitForHydration } from "../helpers/browser";
import { expect, test } from "./fixtures";

// The E2E server has no Claude key, so the agent answers "off": this checks the path end to end
// (the toggle, the hand-off, the POST and its stream) without calling Claude
test("describes a vibe, and says when the AI isn't available", async ({ page }) => {
  await page.goto("/");
  await waitForHydration(page);
  await page.getByRole("group", { name: "Start from" }).getByText("By vibe").click();

  await page.getByLabel("Describe what you're in the mood for").fill("Lazy jazz for a rainy afternoon");
  await page.getByRole("button", { name: "Find artists" }).click();

  await expect(page).toHaveURL("/describe?q=Lazy+jazz+for+a+rainy+afternoon");
  await expect(page.getByRole("heading", { name: "What are you in the mood for?" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("isn't available right now");

  await page.getByRole("link", { name: "Pick artists by name" }).click();
  await expect(page).toHaveURL("/");
});
