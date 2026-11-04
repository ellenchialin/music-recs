import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: ["@pinia/nuxt", "@vueuse/nuxt", "@nuxt/eslint", "@nuxt/test-utils/module", "motion-v/nuxt"],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      link: [
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=Noto+Serif:wdth,wght@62.5,900&family=Noto+Sans+TC:wght@400;500;700&display=swap",
        },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  // 換頁用瀏覽器的 View Transitions：首頁的唱盤「飛」到推薦頁中央（同名的 view-transition-name）。
  // 不支援的瀏覽器、開了「減少動態效果」時 Nuxt 自動跳過，直接換頁
  experimental: {
    viewTransition: true,
  },
  typescript: {
    strict: true,
  },
});
