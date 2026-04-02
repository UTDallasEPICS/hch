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
    // Serve uploaded files as static assets (for development)
    publicAssets: [
      {
        dir: 'uploads',
        baseURL: '/uploads',
        maxAge: 60 * 60 * 24, // 1 day cache
      },
    ],
  },

  typescript: {
    strict: true,
    shim: false,
  },

  vite: {
    // Default SSR module IPC timeout is 60s; on Windows or with heavy dev load (e.g. Prisma Studio
    // via `pnpm run dev`) vite-node can hit it and show "Request timeout ... for type: module".
    viteNode: {
      requestTimeout: 120_000,
    },
    resolve: {
      dedupe: [
        'prosemirror-model',
        'prosemirror-state',
        'prosemirror-view',
        'prosemirror-transform',
      ],
    },
  },
})
