import { defineVitestProject } from "@nuxt/test-utils/config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // 純函式（推薦演算法、排序、統計、zod schema）：一般 Node 環境，最快
      {
        test: {
          name: "unit",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          environment: "node",
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
