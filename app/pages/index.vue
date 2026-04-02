<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

  const { data: adminData } = await useFetch<{ isAdmin: boolean }>('/api/user/is-admin', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const isAdminUser = adminData.value?.isAdmin === true

  type AdminStats = {
    userCount: number
    clientCount: number
    pendingSessionNotesRequests: number
    displayName: string
    statusLabel: string
  }

  type ClientStats = {
    displayName: string
    statusLabel: string
    clinicalStatus: string | null
    therapyWeekDisplay: string
    formsProgressDisplay: string
    pendingSessionNotesRequests: number
  }

  const statsFetch = isAdminUser
    ? await useFetch<AdminStats>('/api/admin/dashboard-stats', {
        getCachedData: () => undefined,
      })
    : await useFetch<ClientStats>('/api/client/dashboard-stats', {
        getCachedData: () => undefined,
      })

  const { data: stats, pending, error, refresh } = statsFetch

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <!-- Admin: same layout as before -->
  <main
    v-if="isAdminUser"
    class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
  >
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div class="min-w-0 flex-1">
        <template v-if="pending">
          <USkeleton class="mb-3 h-10 max-w-lg" />
          <USkeleton class="h-6 w-56" />
        </template>
        <template v-else-if="stats">
          <h1
            class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white"
          >
            Welcome, {{ stats.displayName }}!!!
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Your status:</span>
            <UBadge color="primary" variant="soft" size="md">{{ stats.statusLabel }}</UBadge>
          </div>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Overview of your clinic workspace. Open Clients for the full client list and actions.
          </p>
        </template>
        <template v-else>
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Dashboard
          </h1>
        </template>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <UButton
          color="error"
          variant="soft"
          icon="i-heroicons-arrow-right-on-rectangle-20-solid"
          label="Logout"
          @click="logout"
        />
      </div>
    </div>

    <div v-if="pending" class="grid gap-4 sm:grid-cols-3">
      <div
        v-for="i in 3"
        :key="i"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <USkeleton class="mb-2 h-4 w-24" />
        <USkeleton class="h-8 w-16" />
      </div>
    </div>

    <div v-else-if="error">
      <UAlert
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Could not load dashboard"
        :description="error.message"
      >
        <template #actions>
          <UButton label="Retry" size="sm" variant="soft" @click="() => refresh()" />
        </template>
      </UAlert>
    </div>

    <template v-else-if="stats">
      <div class="grid gap-4 sm:grid-cols-3">
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-users-20-solid" class="h-5 w-5" />
            Registered users
          </div>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ stats.userCount }}
          </p>
        </div>
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-user-group-20-solid" class="h-5 w-5" />
            Clients
          </div>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ stats.clientCount }}
          </p>
        </div>
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-document-text-20-solid" class="h-5 w-5" />
            Pending note requests
          </div>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-gray-900 dark:text-white">
            {{ stats.pendingSessionNotesRequests }}
          </p>
        </div>
      </div>

      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Quick links</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Jump to common admin tools.
        </p>
        <div class="mt-4 flex flex-wrap gap-3">
          <UButton to="/clients" label="Clients" color="primary" icon="i-heroicons-user-group-20-solid" />
          <div class="inline-flex flex-wrap items-center gap-2">
            <UButton
              to="/clients/session-notes-requests"
              label="Session note requests"
              color="primary"
              variant="soft"
              icon="i-heroicons-inbox-arrow-down-20-solid"
            />
            <UBadge
              v-if="stats.pendingSessionNotesRequests > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              {{ stats.pendingSessionNotesRequests }} pending
            </UBadge>
          </div>
          <UButton
            to="/notes-test"
            label="Notes"
            color="primary"
            variant="soft"
            icon="i-heroicons-pencil-square-20-solid"
          />
        </div>
      </div>
    </template>
  </main>

  <!-- Client: match admin structure -->
  <main
    v-else
    class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8"
  >
    <ClientDashboardHero
      :pending="pending"
      :display-name="stats?.displayName"
      :status-label="stats?.statusLabel"
      :clinical-status="stats?.clinicalStatus ?? null"
      description="Your care journey and tasks at a glance."
      :therapy-week-display="stats?.therapyWeekDisplay ?? '—'"
      :forms-progress-display="stats?.formsProgressDisplay ?? '—'"
      :pending-session-notes-requests="stats?.pendingSessionNotesRequests ?? 0"
      :error="error"
      @retry="refresh()"
    />
    <ClientSessionNotesSection />
  </main>
</template>
