import { defineVitestProject } from "@nuxt/test-utils/config";
import { defineConfig } from "vitest/config";

// DB 測試一律連到獨立的測試資料庫，絕不碰開發用的 music。
// 寫回 process.env 是給 globalSetup 用的：它跑在主程序，test.env 只作用在測試 worker
const testDatabaseUrl = (process.env.TEST_DATABASE_URL ??= "postgres://app:app@localhost:5434/music_test");

export default defineConfig({
  test: {
    projects: [
      // 純函式（推薦演算法、排序、統計、zod schema）：一般 Node 環境，最快
      {
        test: {
          name: "unit",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          exclude: ["**/*.db.test.ts"],
          environment: "node",
        },
      },
      // 碰資料庫的測試：檔名 *.db.test.ts，跑之前自動建好 music_test 並套用 migration
      {
        test: {
          name: "db",
          include: ["server/**/*.db.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/db-global-setup.ts"],
          // 測試共用同一個資料庫，檔案之間不能平行跑
          fileParallelism: false,
          env: { DATABASE_URL: testDatabaseUrl, TEST_DATABASE_URL: testDatabaseUrl },
        },
      },
      // Vue 元件與 composable：需要 Nuxt 的 auto-import 和 runtime，跑在 happy-dom 模擬的瀏覽器裡
      await defineVitestProject({
        test: {
          name: "nuxt",
          include: ["app/**/*.test.ts"],
          environment: "nuxt",
          environmentOptions: { nuxt: { domEnvironment: "happy-dom" } },
        },
      }),
    ],
  },
});
