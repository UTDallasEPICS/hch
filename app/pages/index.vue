<script setup lang="ts">
  import { authClient } from '../utils/auth-client'

  const { data: adminData } = await useFetch<{
    isAdmin: boolean
    isClinician: boolean
    isStaff: boolean
  }>('/api/users/me/is-admin', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const isAdminUser = adminData.value?.isStaff === true

  type AdminStats = {
    userCount: number
    clientCount: number
    pendingSessionNotesRequests: number
    pendingAppointmentScheduleRequests: number
    pendingNoteApprovals: number
    unreadNotifications: number
    displayName: string
    statusLabel: string
    /** Not used for admin; optional so `stats` union matches client payload shape. */
    clientDisplayName?: string
  }

  type UpcomingAppointmentItem = {
    id: string
    title: string
    startTime: string
    endTime: string
    videoProvider: string | null
    videoJoinUrl: string | null
  }

  type ClientStats = {
    displayName: string
    clientDisplayName?: string
    statusLabel: string
    clinicalStatus: string | null
    therapyWeekDisplay: string
    formsProgressDisplay: string
    pendingSessionNotesRequests: number
    upcomingAppointments: UpcomingAppointmentItem[]
  }

  const statsFetch = isAdminUser
    ? await useFetch<AdminStats>('/api/admin/dashboard-stats', {
        getCachedData: () => undefined,
      })
    : await useFetch<ClientStats>('/api/client/dashboard-stats', {
        getCachedData: () => undefined,
      })

  const { data: stats, pending, error, refresh } = statsFetch

  const clientStats = computed(() => {
    if (isAdminUser) return null
    return stats.value as ClientStats | null
  })

  const adminStats = computed(() => {
    if (!isAdminUser) return null
    return stats.value as AdminStats | null
  })

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <!-- Admin: same layout as before -->
  <main v-if="isAdminUser" class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div class="min-w-0 flex-1">
        <template v-if="pending">
          <USkeleton class="mb-3 h-10 max-w-lg" />
          <USkeleton class="h-6 w-56" />
        </template>
        <template v-else-if="adminStats">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Welcome, {{ adminStats.displayName }} !!!
          </h1>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Your status:</span>
            <UBadge color="primary" variant="soft" size="md">{{ adminStats.statusLabel }}</UBadge>
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

    <div v-if="pending" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

    <template v-else-if="adminStats">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-user-group-20-solid" class="h-5 w-5" />
            Clients
          </div>
          <p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ adminStats.clientCount }}
          </p>
        </div>
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-document-text-20-solid" class="h-5 w-5" />
            Pending records requests
          </div>
          <p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ adminStats.pendingSessionNotesRequests }}
          </p>
        </div>
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-calendar-days-20-solid" class="h-5 w-5" />
            Session time requests
          </div>
          <p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ adminStats.pendingAppointmentScheduleRequests ?? 0 }}
          </p>
        </div>
        <NuxtLink
          to="/clients/session-notes-approvals"
          class="hover:border-primary-300 focus:ring-primary-500 focus:outline-none focus-visible:ring-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-colors dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-600"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-check-badge-20-solid" class="h-5 w-5" />
            Notes awaiting approval
          </div>
          <div class="mt-2 flex items-end justify-between gap-2">
            <p class="text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
              {{ adminStats.pendingNoteApprovals }}
            </p>
            <UBadge
              v-if="adminStats.pendingNoteApprovals > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              Action needed
            </UBadge>
          </div>
        </NuxtLink>
      </div>

      <div
        class="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Quick links</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Jump to common admin tools.</p>
        <div class="mt-4 flex flex-wrap gap-3">
          <UButton
            to="/clients"
            label="Clients"
            color="primary"
            icon="i-heroicons-user-group-20-solid"
          />
          <div class="inline-flex flex-wrap items-center gap-2">
            <UButton
              to="/clients/session-notes-requests"
              label="Records requests"
              color="primary"
              variant="soft"
              icon="i-heroicons-inbox-arrow-down-20-solid"
            />
            <UBadge
              v-if="adminStats.pendingSessionNotesRequests > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              {{ adminStats.pendingSessionNotesRequests }} pending
            </UBadge>
          </div>
          <div class="inline-flex flex-wrap items-center gap-2">
            <UButton
              to="/clients/appointment-schedule-requests"
              label="Session time requests"
              color="primary"
              variant="soft"
              icon="i-heroicons-calendar-days-20-solid"
            />
            <UBadge
              v-if="(adminStats.pendingAppointmentScheduleRequests ?? 0) > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              {{ adminStats.pendingAppointmentScheduleRequests ?? 0 }} pending
            </UBadge>
          </div>
          <UButton
            to="/notes-test"
            label="Notes"
            color="primary"
            variant="soft"
            icon="i-heroicons-pencil-square-20-solid"
          />
          <div class="inline-flex flex-wrap items-center gap-2">
            <UButton
              to="/clients/session-notes-approvals"
              label="Note approvals"
              color="primary"
              variant="soft"
              icon="i-heroicons-check-badge-20-solid"
            />
            <UBadge
              v-if="adminStats.pendingNoteApprovals > 0"
              color="warning"
              variant="subtle"
              size="sm"
            >
              {{ adminStats.pendingNoteApprovals }} pending
            </UBadge>
          </div>
        </div>
      </div>

      <NotificationsPanel class="mt-8" />
    </template>
  </main>

  <!-- Client: dashboard with stats and session notes -->
  <main v-else class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <ClientDashboardHero
      :pending="pending"
      :display-name="clientStats?.displayName"
      :client-display-name="clientStats?.clientDisplayName"
      :status-label="clientStats?.statusLabel"
      :clinical-status="clientStats?.clinicalStatus ?? null"
      description="Your care journey and tasks at a glance."
      :therapy-week-display="clientStats?.therapyWeekDisplay ?? '—'"
      :forms-progress-display="clientStats?.formsProgressDisplay ?? '—'"
      :pending-session-notes-requests="clientStats?.pendingSessionNotesRequests ?? 0"
      :error="error"
      @retry="refresh()"
    />
    <ClientUpcomingAppointments
      v-if="!error"
      :pending="pending"
      :appointments="clientStats?.upcomingAppointments ?? []"
    />
    <ClientScheduleRequestsSection v-if="!error && clientStats?.clinicalStatus != null" />
    <ClientSessionNotesSection />
  </main>
</template>
