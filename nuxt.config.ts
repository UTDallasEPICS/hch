// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  srcDir: 'app',
  nitro: {
    // Allow larger payloads for justification flows (reasoning + signature + optional PDF/Word)
    bodyLimit: '15mb',
  },
})
