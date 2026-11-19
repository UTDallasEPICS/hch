<script setup lang="ts">
  import { authClient } from '../utils/auth-client'
  import { getAttendanceStatusMeta } from '../utils/attendance-status'

  // REQ-F-11 (#218). Admins pick any clinician; a clinician sees only their own log.
  definePageMeta({ middleware: 'staff-only' })

  type LogRow = {
    id: string
    event: 'SIGNED' | 'CORRECTED' | 'UNSIGNED' | 'APPROVED' | 'BACKFILL'
    sessionDate: string
    startTime: string
    endTime: string
    durationMinutes: number
    countedMinutes: number
    attendanceStatus: string
    noteStatus: 'DRAFT' | 'CLINICIAN_SIGNED' | 'FULLY_APPROVED'
    supersedesId: string | null
    current: boolean
    recordedAt: string
  }

  type Report = {
    clinician: { id: string; name: string }
    timeZone: string
    range: { from: string | null; to: string | null }
    rows: LogRow[]
    totals: { countedHours: number; countedMinutes: number; countedSessions: number }
  }

  const route = useRoute()
  const router = useRouter()

  const { data: role } = await useFetch<{ isAdmin: boolean }>('/api/users/me/is-admin', {
    key: 'session-log-role',
  })
  const isAdminViewer = computed(() => role.value?.isAdmin === true)
  const { data: session } = await authClient.useSession(useFetch)
  const currentUserId = computed(() => (session.value?.user as { id?: string } | null)?.id ?? '')

  const { data: clinicians } = await useFetch<{ id: string; name: string; email: string }[]>(
    '/api/clinicians',
    { key: 'session-log-clinicians', immediate: isAdminViewer.value }
  )
  const clinicianItems = computed(() =>
    (clinicians.value ?? []).map((c) => ({
      label: c.name.replace('||', ' ') || c.email,
      value: c.id,
    }))
  )

  function isoDate(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const today = new Date()

  const queryClinician = typeof route.query.clinician === 'string' ? route.query.clinician : ''
  const clinicianId = ref(
    isAdminViewer.value
      ? queryClinician || clinicianItems.value[0]?.value || ''
      : currentUserId.value
  )
  const from = ref(
    typeof route.query.from === 'string' ? route.query.from : `${today.getFullYear()}-01-01`
  )
  const to = ref(typeof route.query.to === 'string' ? route.query.to : isoDate(today))

  const rangeQuery = computed(() => ({
    ...(from.value && { from: from.value }),
    ...(to.value && { to: to.value }),
  }))

  const {
    data: report,
    pending,
    error,
  } = await useFetch<Report>(() => `/api/clinicians/${clinicianId.value}/session-log`, {
    query: rangeQuery,
    immediate: Boolean(clinicianId.value),
    watch: [clinicianId],
  })

  // Keep the URL in sync so a view can be bookmarked or shared with another admin.
  watch([clinicianId, from, to], () => {
    router.replace({
      query: {
        ...(isAdminViewer.value && clinicianId.value && { clinician: clinicianId.value }),
        ...rangeQuery.value,
      },
    })
  })

  const exportUrl = computed(() => {
    const params = new URLSearchParams(rangeQuery.value)
    const qs = params.toString()
    return `/api/clinicians/${clinicianId.value}/session-log/export${qs ? `?${qs}` : ''}`
  })

  const NOTE_STATUS_LABEL: Record<LogRow['noteStatus'], string> = {
    DRAFT: 'Unsigned',
    CLINICIAN_SIGNED: 'Signed',
    FULLY_APPROVED: 'Approved',
  }
  const EVENT_LABEL: Record<LogRow['event'], string> = {
    SIGNED: 'Signed',
    CORRECTED: 'Corrected',
    UNSIGNED: 'Unsigned',
    APPROVED: 'Approved',
    BACKFILL: 'Imported',
  }

  function attendanceLabel(value: string) {
    return getAttendanceStatusMeta(value)?.label ?? (value || '—')
  }
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
        Session log
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Signed sessions and their hours, for credentialing. Entries are never edited: a correction
        is a new entry, and the one it replaced stays here as history.
      </p>
    </div>

    <div
      class="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end dark:border-gray-800 dark:bg-gray-900"
    >
      <UFormField v-if="isAdminViewer" label="Clinician" class="sm:min-w-[16rem]">
        <USelect
          v-model="clinicianId"
          :items="clinicianItems"
          placeholder="Choose a clinician"
          class="w-full"
        />
      </UFormField>
      <UFormField label="From">
        <UInput v-model="from" type="date" />
      </UFormField>
      <UFormField label="To">
        <UInput v-model="to" type="date" />
      </UFormField>
      <UButton
        v-if="clinicianId"
        :to="exportUrl"
        external
        icon="i-heroicons-arrow-down-tray"
        label="Export CSV"
        color="primary"
        class="sm:ml-auto"
      />
    </div>

    <UAlert
      v-if="!clinicianId"
      icon="i-heroicons-information-circle-20-solid"
      color="neutral"
      variant="subtle"
      title="No clinician selected"
      description="Choose a clinician to see their session log."
    />

    <UAlert
      v-else-if="error"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="error"
      variant="subtle"
      title="Error loading the session log"
      :description="error.statusMessage || error.message"
    />

    <div v-else-if="pending" class="space-y-3">
      <USkeleton class="h-24 rounded-xl" />
      <USkeleton v-for="i in 5" :key="i" class="h-10 w-full" />
    </div>

    <template v-else-if="report">
      <div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricTile
          :label="`Counted hours for ${report.clinician.name}`"
          :value="report.totals.countedHours"
          unit="hours"
        />
        <MetricTile
          label="Counted sessions"
          :value="report.totals.countedSessions"
          unit="sessions"
          hint="Signed sessions marked Show"
        />
      </div>

      <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table class="w-full text-left text-sm">
          <thead
            class="bg-gray-50 text-xs text-gray-500 uppercase dark:bg-gray-900 dark:text-gray-400"
          >
            <tr>
              <th class="px-4 py-3 font-medium">Date</th>
              <th class="px-4 py-3 font-medium">Time</th>
              <th class="px-4 py-3 text-right font-medium">Minutes</th>
              <th class="px-4 py-3 text-right font-medium">Counted</th>
              <th class="px-4 py-3 font-medium">Attendance</th>
              <th class="px-4 py-3 font-medium">Note</th>
              <th class="px-4 py-3 font-medium">Entry</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
            <tr
              v-for="row in report.rows"
              :key="row.id"
              :class="{ 'text-gray-400 dark:text-gray-500': !row.current }"
            >
              <td class="px-4 py-3 whitespace-nowrap">{{ row.sessionDate }}</td>
              <td class="px-4 py-3 whitespace-nowrap">{{ row.startTime }}–{{ row.endTime }}</td>
              <td class="px-4 py-3 text-right">{{ row.durationMinutes }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ row.countedMinutes }}</td>
              <td class="px-4 py-3">{{ attendanceLabel(row.attendanceStatus) }}</td>
              <td class="px-4 py-3">{{ NOTE_STATUS_LABEL[row.noteStatus] }}</td>
              <td class="px-4 py-3">
                {{ EVENT_LABEL[row.event] }}
                <UBadge v-if="!row.current" color="neutral" variant="soft" size="sm" class="ml-1">
                  Replaced
                </UBadge>
              </td>
            </tr>
            <tr v-if="report.rows.length === 0">
              <td colspan="7" class="px-4 py-6 text-center text-gray-500">
                No signed sessions in this date range.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Dates and times are in clinic time ({{ report.timeZone }}). Replaced entries are kept for
        history and are not counted.
      </p>
    </template>
  </main>
</template>
