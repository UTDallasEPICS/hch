<script setup lang="ts">
  const route = useRoute()
  const colorMode = useColorMode()

  const isTasksPage = computed(() => route.path === '/taskPage')
  const isDashboardPage = computed(() => route.path === '/')

  const isDark = computed({
    get() {
      return colorMode.value === 'dark'
    },
    set() {
      colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
    },
  })
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
          <NuxtLink to="/" class="flex items-center gap-2 font-bold">
            <img
              src="/HCH%20Light%20Mode%20Logo.png"
              alt="Hope Cope Heal logo"
              class="h-8 w-auto dark:hidden"
            />
            <img
              src="/HCH%20Dark%20Mode%20Logo.png"
              alt="Hope Cope Heal logo"
              class="hidden h-8 w-auto dark:block"
            />
            <span class="text-sm leading-none whitespace-nowrap sm:hidden">Hope.Cope.Heal.</span>
            <span class="hidden text-xl leading-none whitespace-nowrap sm:inline">Hope. Cope. Heal.</span>
          </NuxtLink>

          <div class="flex items-center gap-2">
            <UButton
              label="Dashboard"
              to="/"
              color="primary"
              :variant="isDashboardPage ? 'solid' : 'soft'"
            />
            <UButton
              label="Tasks"
              to="/taskPage"
              color="primary"
              :variant="isTasksPage ? 'solid' : 'soft'"
            />
            <UButton
              :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
              color="neutral"
              variant="ghost"
              @click="isDark = !isDark"
              aria-label="Toggle Theme"
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
