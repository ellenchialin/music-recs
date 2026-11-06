import { defineVitestProject } from "@nuxt/test-utils/config";
import { defineConfig } from "vitest/config";

// DB tests always use music_test, never the dev database. Written to process.env because
// globalSetup runs in the main process, where test.env doesn't apply
const testDatabaseUrl = (process.env.TEST_DATABASE_URL ??= "postgres://app:app@localhost:5434/music_test");

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          exclude: ["**/*.db.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "db",
          include: ["server/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/db-global-setup.ts"],
          // Files share one database
          fileParallelism: false,
          env: { DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl },
        },
      },
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["app/**/*.test.ts"],
          environment: "nuxt",
          environmentOptions: { nuxt: { domEnvironment: "happy-dom" } },
          setupFiles: ["tests/setup/nuxt-setup.ts"],
        },
      }),
    ],
  },
});
