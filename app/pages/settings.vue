<script setup lang="ts">
  type CalendarStatus = {
    connected: boolean
    status: 'ACTIVE' | 'NEEDS_RECONNECT' | 'DISCONNECTED' | null
    provider: 'GOOGLE' | null
    calendarId: string | null
    lastSyncedAt: string | null
  }

  const toast = useToast()
  const route = useRoute()
  const disconnectOpen = ref(false)
  const disconnecting = ref(false)

  const {
    data: calendarStatus,
    pending: calendarPending,
    error: calendarError,
    refresh: refreshCalendarStatus,
  } = await useFetch<CalendarStatus>('/api/calendar/google/status')

  const statusLabel = computed(() => {
    if (calendarStatus.value?.status === 'ACTIVE') {
      return 'Connected'
    }
    if (calendarStatus.value?.status === 'NEEDS_RECONNECT') {
      return 'Needs reconnect'
    }
    return 'Not connected'
  })

  function connectGoogleCalendar() {
    window.location.assign('/api/calendar/google/connect')
  }

  async function disconnectGoogleCalendar() {
    disconnecting.value = true
    try {
      await $fetch('/api/calendar/google/disconnect', { method: 'DELETE' })
      disconnectOpen.value = false
      await refreshCalendarStatus()
      toast.add({
        title: 'Disconnected',
        description: 'Google Calendar was disconnected.',
        color: 'success',
      })
    } catch {
      toast.add({
        title: 'Disconnect failed',
        description: 'Google Calendar could not be disconnected.',
        color: 'error',
      })
    } finally {
      disconnecting.value = false
    }
  }

  if (route.query.calendar === 'connected') {
    toast.add({
      title: 'Google Calendar connected',
      description: 'Your Google Calendar is now connected.',
      color: 'success',
    })
  } else if (route.query.calendar === 'error') {
    toast.add({
      title: 'Google Calendar connection failed',
      description: 'Grant Calendar access and try again.',
      color: 'error',
    })
  }

  watch(
    () => route.query.calendar,
    async (calendarQuery) => {
      if (calendarQuery === 'connected' || calendarQuery === 'error') {
        await navigateTo('/settings', { replace: true })
      }
    },
    { immediate: true }
  )
</script>

<template>
  <UContainer class="py-8">
    <div class="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 class="text-2xl font-semibold">Settings</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage integrations for your account.
        </p>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-calendar-days" class="h-6 w-6 text-primary" />
              <div>
                <h2 class="font-semibold">Google Calendar</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">Calendar event access</p>
              </div>
            </div>
            <UBadge
              v-if="!calendarPending && !calendarError"
              :color="calendarStatus?.status === 'ACTIVE'
                ? 'success'
                : calendarStatus?.status === 'NEEDS_RECONNECT'
                  ? 'warning'
                  : 'neutral'"
              variant="subtle"
            >
              {{ statusLabel }}
            </UBadge>
          </div>
        </template>

        <div v-if="calendarPending" class="flex items-center gap-2 text-sm">
          <UIcon name="i-heroicons-arrow-path" class="h-4 w-4 animate-spin" />
          Loading calendar connection...
        </div>
        <UAlert
          v-else-if="calendarError"
          color="error"
          variant="subtle"
          title="Could not load calendar status"
          description="Retry to check your Google Calendar connection."
        >
          <template #actions>
            <UButton label="Retry" size="sm" variant="soft" @click="refreshCalendarStatus" />
          </template>
        </UAlert>
        <div v-else class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {{ calendarStatus?.status === 'ACTIVE'
              ? 'Google Calendar is connected. Your account can use the calendar integration.'
              : calendarStatus?.status === 'NEEDS_RECONNECT'
                ? 'Google Calendar access needs to be renewed before it can be used.'
                : 'Google Calendar is not connected.' }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="calendarStatus?.status !== 'ACTIVE'"
              :label="calendarStatus?.status === 'NEEDS_RECONNECT'
                ? 'Reconnect Google Calendar'
                : 'Connect Google Calendar'"
              color="primary"
              @click="connectGoogleCalendar"
            />
            <UButton
              v-if="calendarStatus?.connected || calendarStatus?.status === 'NEEDS_RECONNECT'"
              label="Disconnect"
              color="error"
              variant="outline"
              @click="disconnectOpen = true"
            />
          </div>
        </div>
      </UCard>
    </div>

    <UModal
      v-model:open="disconnectOpen"
      title="Disconnect Google Calendar?"
      :ui="{ footer: 'justify-end' }"
    >
      <template #body>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          This removes the saved Google Calendar connection from your account.
        </p>
      </template>
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="disconnectOpen = false" />
        <UButton
          label="Disconnect"
          color="error"
          :loading="disconnecting"
          @click="disconnectGoogleCalendar"
        />
      </template>
    </UModal>
  </UContainer>
</template>
