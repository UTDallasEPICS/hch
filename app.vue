<script setup lang="ts">
  import { authClient } from '~/utils/auth-client'

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
        class="sticky top-0 z-50 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <UContainer class="flex h-16 items-center justify-between">
          <NuxtLink to="/" class="flex items-center gap-2 text-xl font-bold">
            <UIcon name="i-heroicons-cube-transparent" class="text-primary-500 h-8 w-8" />
            <span>Hope. Cope. Heal.</span>
          </NuxtLink>
          <nav class="flex items-center gap-1">
            <NuxtLink
              to="/"
              class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              active-class="!bg-primary-100 !text-primary-700 dark:!bg-primary-800 dark:!text-primary-200"
            >
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/tasks"
              class="rounded-md px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
              active-class="!bg-primary-100 !text-primary-700 dark:!bg-primary-800 dark:!text-primary-200"
            >
              Tasks
            </NuxtLink>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-heroicons-arrow-right-on-rectangle-20-solid"
              label="Logout"
              @click="logout"
            />
            <UButton
              :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
              color="neutral"
              variant="ghost"
              @click="isDark = !isDark"
              aria-label="Toggle Theme"
            />
          </nav>
        </UContainer>
      </header>

      <main class="flex-1">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
