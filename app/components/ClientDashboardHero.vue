<script setup lang="ts">
  import { authClient } from '~/utils/auth-client'

  const props = defineProps<{
    pending: boolean
    displayName?: string
    /** When the application lists a different patient (child) than the client, shown under the welcome line. */
    clientDisplayName?: string
    statusLabel?: string
    /** Raw client status; drives badge color to match the tasks page. */
    clinicalStatus?: string | null
    description: string
    therapyWeekDisplay: string
    formsProgressDisplay: string
    pendingSessionNotesRequests: number
    error?: Error | null
  }>()

  /** Same mapping as `taskPage.vue` status badges. */
  const statusBadgeColor = computed(() => {
    const s = props.clinicalStatus
    if (s === 'INCOMPLETE') return 'warning' as const
    if (s === 'WAITLIST') return 'primary' as const
    if (s === 'ACTIVE') return 'success' as const
    return 'neutral' as const
  })

  const emit = defineEmits<{
    retry: []
  }>()

  async function logout() {
    await authClient.signOut()
    await navigateTo('/auth', { external: true })
  }
</script>

<template>
  <div>
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
      <div class="min-w-0 flex-1">
        <template v-if="pending">
          <USkeleton class="mb-3 h-10 max-w-lg" />
          <USkeleton class="h-6 w-56" />
        </template>
        <template v-else-if="displayName != null && statusLabel != null">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            Welcome, {{ displayName }} !!!
          </h1>
          <p v-if="clientDisplayName" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ clientDisplayName }}
          </p>
          <UBadge class="mt-2" :color="statusBadgeColor" variant="soft" size="md">
            Your status: {{ statusLabel }}
          </UBadge>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ description }}
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

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Could not load dashboard"
      :description="error.message"
    >
      <template #actions>
        <UButton label="Retry" size="sm" variant="soft" @click="emit('retry')" />
      </template>
    </UAlert>

    <template v-else-if="displayName != null && statusLabel != null">
      <div class="grid gap-4 sm:grid-cols-3">
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-calendar-days-20-solid" class="h-5 w-5" />
            Therapy week
          </div>
          <p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ therapyWeekDisplay }}
          </p>
        </div>
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-clipboard-document-check-20-solid" class="h-5 w-5" />
            Forms progress
          </div>
          <p class="mt-2 text-3xl font-semibold text-gray-900 tabular-nums dark:text-white">
            {{ formsProgressDisplay }}
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
            {{ pendingSessionNotesRequests }}
          </p>
        </div>
      </div>

      <div class="mt-6">
        <UButton
          to="/taskPage"
          color="primary"
          variant="solid"
          size="lg"
          block
          class="sm:inline-flex sm:w-auto"
          icon="i-heroicons-clipboard-document-list"
          label="View and complete your forms"
        />
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Same forms as in email reminders from your team—open them here anytime after you sign in.
        </p>
      </div>
    </template>
  </div>
</template>
