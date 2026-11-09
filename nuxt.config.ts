import tailwindcss from "@tailwindcss/vite";

// Production only: Vite's dev server needs inline scripts and websockets that this CSP blocks.
// script-src needs 'unsafe-inline' for Nuxt's inline config script (nonces would need a module);
// style-src for the inline styles Motion sets. Media comes from iTunes, fonts from Google
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: https://*.mzstatic.com",
  "media-src https://*.itunes.apple.com https://*.mzstatic.com",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = {
  "Content-Security-Policy": contentSecurityPolicy,
  // frame-ancestors covers modern browsers; X-Frame-Options covers older ones (clickjacking)
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

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
  $production: {
    routeRules: { "/**": { headers: securityHeaders } },
  },
});
