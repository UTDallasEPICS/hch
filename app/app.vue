<script setup lang="ts">
  import { authClient } from './utils/auth-client'

  const colorMode = useColorMode()

  const isDark = computed({
    get() {
      return colorMode.value === 'dark'
    },
    set() {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  })

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <UApp>
    <div
      class="flex min-h-screen flex-col bg-white text-gray-900 transition-colors duration-300 dark:bg-gray-900 dark:text-gray-100"
    >
      <header
        class="sticky top-0 z-50 border-b border-gray-200 bg-white/75 backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/75"
      >
        <UContainer class="flex h-16 items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-2 text-xl font-bold">
            <img src="/hopecopeheallogo.png" alt="Hope. Cope. Heal." class="h-8 w-auto" />
          </NuxtLink>

          <nav class="flex items-center gap-4">
            <NuxtLink
              to="/"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/tasks"
              class="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Tasks
            </NuxtLink>
          </nav>

          <div class="flex items-center gap-2">
            <UButton
              :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
              color="neutral"
              variant="ghost"
              aria-label="Toggle Theme"
              @click="isDark = !isDark"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-heroicons-arrow-right-on-rectangle-20-solid"
              label="Logout"
              @click="logout"
            />
          </div>
        </UContainer>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
