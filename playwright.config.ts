import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, FAKE_LASTFM_API_KEY } from "./tests/e2e/outside-world";

const PORT = 3100;
const BLOCK_OUTSIDE = "NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:9 HTTP_PROXY=http://127.0.0.1:9 NO_PROXY=localhost,127.0.0.1";

// E2E tests drive the production build, so security headers and the CSP apply as on the live site
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  // channel "chromium": the full browser in new headless mode, closer to real Chrome than the
  // separate headless shell (which `--no-shell` skips downloading)
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium" } }],
  webServer: {
    // Build every run (a few seconds), so running Playwright from an editor never tests a stale build.
    // The server's own outside calls go through a proxy that refuses connections, so a cache miss
    // fails at once instead of reaching Last.fm or iTunes (Node 24's fetch honors these variables).
    // Only for the server: pnpm itself downloads through corepack during the build
    command: `pnpm build && env ${BLOCK_OUTSIDE} node .output/server/index.mjs`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      DATABASE_URL: E2E_DATABASE_URL,
      LASTFM_API_KEY: FAKE_LASTFM_API_KEY,
      RATE_LIMIT_SALT: "e2e-only-salt-not-used-anywhere-else",
      // Empty turns LLM reasons off, even if the shell running the tests has a real key
      ANTHROPIC_API_KEY: "",
    },
  },
});
