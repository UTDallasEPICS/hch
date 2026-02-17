// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['./assets/css/main.css'],
  srcDir: 'app',
  // Optional: ensure form routes are handled by the app (no prerender 404)
  // routeRules: { '/forms/**': { ssr: true } },
})
