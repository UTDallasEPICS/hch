// https://nuxt.com/docs/api/configuration/nuxt-config

/** Rollup plugin: on Windows, replace absolute path string literals in the bundle with file:// URLs so the ESM loader does not throw "Received protocol 'c:'". */
function windowsPathToFileUrlPlugin() {
  return {
    name: 'windows-path-to-file-url',
    renderChunk(code: string) {
      if (process.platform !== 'win32') return null
      // Replace "X:\..." or 'X:\...' string literals with "file:///X:/..."
      const rewritten = code.replace(
        /["']([A-Za-z]:(?:\\\\|[^"'\\])*)["']/g,
        (_, pathContent: string) => {
          const path = pathContent.replace(/\\/g, '/')
          return `"file:///${path}"`
        }
      )
      if (rewritten === code) return null
      return { code: rewritten, map: null }
    },
  }
}

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['./assets/css/main.css'],
  nitro: {
    experimental: { legacyExternals: true },
  },
  routeRules: {
    '/tasks': { ssr: true },
    '/forms/**': { ssr: true },
  },
  hooks: {
    'nitro:build:before'(nitro) {
      const plugin = windowsPathToFileUrlPlugin()
      const rollup = nitro.options.rollupConfig || (nitro.options.rollupConfig = {} as any)
      const plugins = Array.isArray(rollup.plugins) ? [...rollup.plugins, plugin] : [plugin]
      rollup.plugins = plugins
    },
  },
})
