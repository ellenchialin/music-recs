import { defineConfig, devices } from "@playwright/test";

// The smoke test runs against the live site with real Last.fm and iTunes behind it, so it measures
// what visitors get. Scheduled in .github/workflows/smoke.yml, not on every push
export default defineConfig({
  testDir: "tests/smoke",
  // *.test.ts files next to these are Vitest unit tests
  testMatch: "**/*.spec.ts",
  timeout: 90_000,
  // One at a time, desktop first: desktop measures the uncached path, then mobile reuses the cache
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.SMOKE_URL ?? "https://musicrecs.ellenchen.dev",
    trace: "retain-on-failure",
  },
  // Chrome for Testing plays the AAC previews; see playwright.config.ts for the channel. Mobile is
  // throttled in the test itself (network and CPU need a CDP session)
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chromium" } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chromium" } },
  ],
});
