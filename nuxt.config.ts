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
  // The home turntable morphs into the recommendations page (shared view-transition-name).
  // Nuxt skips it without browser support or with reduced motion
  experimental: {
    viewTransition: true,
  },
  typescript: {
    strict: true,
  },
});
