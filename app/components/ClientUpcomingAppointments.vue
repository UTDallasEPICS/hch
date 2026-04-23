<script setup lang="ts">
  import { VIDEO_PROVIDER_LABEL } from '~/utils/video-conference'

  type UpcomingAppointmentItem = {
    id: string
    title: string
    startTime: string
    endTime: string
    videoProvider: string | null
    videoJoinUrl: string | null
  }

  const props = defineProps<{
    pending: boolean
    appointments: UpcomingAppointmentItem[]
  }>()

  function formatRange(startIso: string, endIso: string) {
    const start = new Date(startIso)
    const end = new Date(endIso)
    const dateStr = start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
    return `${dateStr} · ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`
  }

  function joinLabel(provider: string | null) {
    if (!provider) return 'Join session'
    return VIDEO_PROVIDER_LABEL[provider] ?? 'Join session'
  }
</script>

<template>
  <section class="mt-8">
    <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Upcoming sessions</h2>
        <p class="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
          Your next scheduled appointments. Open Calendar for the full schedule.
        </p>
      </div>
      <UButton
        to="/calendar"
        variant="soft"
        color="primary"
        size="sm"
        icon="i-heroicons-calendar-days-20-solid"
        label="Calendar"
      />
    </div>

    <div
      v-if="pending"
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <USkeleton class="mb-3 h-5 w-48" />
      <USkeleton class="mb-2 h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <div
      v-else-if="appointments.length === 0"
      class="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center dark:border-gray-700 dark:bg-gray-900/40"
    >
      <UIcon
        name="i-heroicons-calendar-days-20-solid"
        class="mx-auto mb-2 h-10 w-10 text-gray-400"
      />
      <p class="text-sm font-medium text-gray-700 dark:text-gray-300">No upcoming sessions</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        When your clinician schedules a visit, it will appear here and on your calendar.
      </p>
    </div>

    <ul
      v-else
      class="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900"
    >
      <li
        v-for="a in appointments"
        :key="a.id"
        class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="min-w-0 flex-1">
          <p class="font-medium text-gray-900 dark:text-white"> {{ a.title }} </p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ formatRange(a.startTime, a.endTime) }}
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <UButton
            v-if="a.videoJoinUrl && a.videoProvider === 'GOOGLE_MEET'"
            :to="a.videoJoinUrl"
            external
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-heroicons-video-camera-20-solid"
            label="Join Google Meet"
          />
          <UButton
            v-else-if="a.videoJoinUrl && a.videoProvider"
            :to="a.videoJoinUrl"
            external
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            variant="soft"
            size="sm"
            icon="i-heroicons-video-camera-20-solid"
            :label="joinLabel(a.videoProvider)"
          />
        </div>
      </li>
    </ul>
  </section>
</template>
