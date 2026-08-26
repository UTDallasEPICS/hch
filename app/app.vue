<script setup lang="ts">
  import { authClient } from './utils/auth-client'

  type SessionUser = {
    id: string
    role?: string | null
  }

  const route = useRoute()
  const colorMode = useColorMode()
  const { data: session } = await authClient.useSession(useFetch)
  const sessionUser = computed(() => (session.value?.user as SessionUser | null) ?? null)

  const {
    data: adminData,
    refresh: refreshAdminData,
    clear: clearAdminData,
  } = await useAsyncData<{
    isAdmin: boolean
    isClinician: boolean
    isStaff: boolean
  } | null>(
    'app-admin-role',
    async () => {
      if (!sessionUser.value?.id) return null
      return await $fetch('/api/users/me/is-admin')
    },
    {
      default: () => null,
    }
  )
  const isAuthenticated = computed(() => Boolean(session.value?.user))
  const inferredIsAdmin = computed(() => sessionUser.value?.role === 'ADMIN')
  const inferredIsStaff = computed(
    () => inferredIsAdmin.value || sessionUser.value?.role === 'CLINICIAN'
  )

  watch(
    () => sessionUser.value?.id,
    (userId) => {
      if (!userId) {
        clearAdminData()
        return
      }
      refreshAdminData()
    },
    { immediate: true }
  )

  const isAdmin = computed(() => adminData.value?.isAdmin ?? inferredIsAdmin.value)
  const isStaff = computed(() => adminData.value?.isStaff ?? inferredIsStaff.value)

  const isTasksPage = computed(() => route.path === '/taskPage')
  const isDashboardPage = computed(() => route.path === '/')
  const isClientsPage = computed(
    () => route.path === '/clients' || route.path.startsWith('/clients/')
  )
  const isCalendarPage = computed(() => route.path === '/calendar')
  /** Temporary: notes playground until session notes are wired in the app flow */
  const isNotesTestPage = computed(
    () => route.path === '/notes-test' || route.path.startsWith('/notes-test/')
  )

  function goTo(path: string) {
    if (route.path !== path) {
      navigateTo(path)
    }
  }

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
      class="flex min-h-screen flex-col bg-gray-50 text-gray-900 transition-colors duration-300 dark:bg-gray-950 dark:text-gray-100"
    >
      <header
        class="sticky top-0 z-50 border-b border-gray-200 bg-white backdrop-blur-md dark:border-gray-800 dark:bg-gray-900"
      >
        <UContainer
          class="max-w-none px-4 py-3 sm:flex sm:h-16 sm:items-center sm:px-6 sm:py-0 lg:px-8"
        >
          <div class="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center justify-between gap-3">
              <NuxtLink
                to="/"
                class="flex min-w-0 items-center gap-2 font-bold text-gray-900 dark:text-white"
              >
                <img
                  src="/HCH%20Light%20Mode%20Logo.png"
                  alt="Hope Cope Heal logo"
                  width="160"
                  height="32"
                  style="height: 32px; width: auto"
                  class="h-8 w-auto dark:hidden"
                />
                <img
                  src="/HCH%20Dark%20Mode%20Logo.png"
                  alt="Hope Cope Heal logo"
                  width="160"
                  height="32"
                  style="height: 32px; width: auto"
                  class="hidden h-8 w-auto dark:block"
                />
                <span class="text-sm leading-none whitespace-nowrap sm:hidden"
                  >Hope.Cope.Heal.</span
                >
                <span class="hidden text-xl leading-none whitespace-nowrap sm:inline"
                  >Hope. Cope. Heal.</span
                >
              </NuxtLink>

              <UButton
                :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
                color="neutral"
                variant="ghost"
                class="sm:hidden"
                @click="isDark = !isDark"
                aria-label="Toggle Theme"
              />
            </div>

            <div class="flex items-center gap-2 sm:justify-end">
              <div
                v-if="isAuthenticated"
                class="flex items-center gap-2 overflow-x-auto pb-1 sm:overflow-visible sm:pb-0"
              >
                <UButton
                  label="Dashboard"
                  color="primary"
                  class="shrink-0"
                  :variant="isDashboardPage ? 'solid' : 'soft'"
                  @click="goTo('/')"
                />
                <UButton
                  v-if="!isStaff"
                  label="Tasks"
                  color="primary"
                  class="shrink-0"
                  :variant="isTasksPage ? 'solid' : 'soft'"
                  @click="goTo('/taskPage')"
                />
                <UButton
                  v-if="isStaff"
                  label="Clients"
                  color="primary"
                  class="shrink-0"
                  :variant="isClientsPage ? 'solid' : 'soft'"
                  @click="goTo('/clients')"
                />
                <UButton
                  label="Calendar"
                  color="primary"
                  class="shrink-0"
                  :variant="isCalendarPage ? 'solid' : 'soft'"
                  @click="goTo('/calendar')"
                />
                <UButton
                  v-if="isStaff"
                  label="Notes"
                  color="primary"
                  class="shrink-0"
                  :variant="isNotesTestPage ? 'solid' : 'soft'"
                  @click="goTo('/notes-test')"
                />
              </div>
              <UButton
                :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
                color="neutral"
                variant="ghost"
                class="hidden shrink-0 sm:inline-flex"
                @click="isDark = !isDark"
                aria-label="Toggle Theme"
              />
            </div>
          </div>
        </UContainer>
      </header>

      <main class="flex-1">
        <NuxtLayout>
          <NuxtPage :page-key="(r) => r.fullPath" />
        </NuxtLayout>
      </main>
    </div>
  </UApp>
</template>
