<script setup lang="ts">
  import type { TableColumn, TableRow } from '@nuxt/ui'
  import { capitalizeName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  type ClientStatus = 'Prospective' | 'Waitlist' | 'Active' | 'Archived'

  const FORM_LABELS: Record<string, string> = {
    application: 'Application',
    physicianStatement: 'Physician Statement (PDF Upload)',
    releaseOfInformationAuthorization: 'ROI Authorization (PDF Upload)',
    ace: 'ACE',
    gad: 'GAD-7',
    phq: 'PHQ-9',
    pcl: 'PCL-5',
  }

  type Client = {
    id: string
    fname: string
    lname: string
    name: string
    email: string
    status: ClientStatus
    allFormsComplete: boolean
    therapyWeek: number | null
    missedSessions: number
    incompleteForms: string[]
  }

  const ALL_STATUS = '__all__'
  const statusFilter = ref<string>(ALL_STATUS)

  type ClientTabCounts = {
    __all__: number
    Prospective: number
    Waitlist: number
    Active: number
    Archived: number
  }

  const { data: clientCounts, refresh: refreshCounts } = await useFetch<ClientTabCounts>(
    '/api/clients/counts',
    {
      getCachedData: () => undefined,
    }
  )

  const statusTabs = computed(() => {
    const c = clientCounts.value
    const n = (key: keyof ClientTabCounts) => c?.[key] ?? 0
    return [
      { value: ALL_STATUS, label: 'All', count: n('__all__') },
      { value: 'Prospective', label: 'Prospective', count: n('Prospective') },
      { value: 'Waitlist', label: 'Waitlist', count: n('Waitlist') },
      { value: 'Active', label: 'Active', count: n('Active') },
      { value: 'Archived', label: 'Archived', count: n('Archived') },
    ] as const
  })

  const queryParams = computed(() => {
    const params: Record<string, string> = {}
    if (statusFilter.value && statusFilter.value !== ALL_STATUS) params.status = statusFilter.value
    return params
  })

  const {
    data: clients,
    pending,
    error,
    refresh: refreshClients,
  } = await useFetch<Client[]>('/api/clients', {
    query: queryParams,
    watch: [queryParams],
    getCachedData: () => undefined,
  })

  const { data: pendingNoteRequests } = await useFetch<{ id: string }[]>(
    '/api/session-notes-requests',
    {
      getCachedData: () => undefined,
    }
  )
  const pendingNoteRequestCount = computed(() => pendingNoteRequests.value?.length ?? 0)

  async function refreshClientsAndCounts() {
    await Promise.all([refreshClients(), refreshCounts()])
  }

  function displayName(c: Client) {
    const raw = c.lname ? `${c.fname} ${c.lname}` : c.fname || c.name || ''
    const trimmed = raw.trim()
    if (!trimmed) {
      return c.status === 'Prospective' ? 'New inquiry' : 'Unknown name'
    }
    return capitalizeName(trimmed)
  }

  function isPlaceholderDisplayName(c: Client) {
    const raw = c.lname ? `${c.fname} ${c.lname}` : c.fname || c.name || ''
    return raw.trim().length === 0
  }

  function statusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      Prospective: 'Prospective',
      Waitlist: 'Waitlist',
      Active: 'Active',
      Archived: 'Archived',
    }
    return labels[status]
  }

  function statusColor(status: ClientStatus): 'warning' | 'primary' | 'success' | 'neutral' {
    const colors: Record<ClientStatus, 'warning' | 'primary' | 'success' | 'neutral'> = {
      Prospective: 'warning',
      Waitlist: 'primary',
      Active: 'success',
      Archived: 'neutral',
    }
    return colors[status]
  }

  function statusVariant(status: ClientStatus): 'soft' | 'outline' {
    return status === 'Archived' ? 'outline' : 'soft'
  }

  function statusIcon(status: ClientStatus): string {
    const icons: Record<ClientStatus, string> = {
      Prospective: 'i-heroicons-clock',
      Waitlist: 'i-heroicons-queue-list',
      Active: 'i-heroicons-check-circle',
      Archived: 'i-heroicons-archive-box',
    }
    return icons[status]
  }

  /** Muted warning text — easier on dark UIs than default amber-400 */
  const WARNING_TEXT_MUTED = 'text-amber-700 dark:text-amber-500/75'

  /** Prospective badge: softer than UBadge `warning` on dark backgrounds */
  const PROSPECTIVE_BADGE_CLASS =
    '!bg-amber-500/10 !text-amber-900 !ring-1 !ring-inset !ring-amber-600/15 dark:!bg-amber-950/40 dark:!text-amber-400/85 dark:!ring-amber-500/25 dark:[&_svg]:text-amber-400/80'

  function statusHint(c: Client): string {
    if (c.status === 'Prospective' && !c.allFormsComplete) {
      return 'To move to waitlist, the client needs to complete all forms'
    }
    return ''
  }

  const showFormsRemainingColumn = computed(
    () => clients.value?.some((c) => c.status === 'Prospective' || c.status === 'Waitlist') ?? false
  )

  const showWeekNoColumn = computed(
    () => clients.value?.some((c) => c.status === 'Active') ?? false
  )

  function formatIncompleteForms(c: Client): string {
    if (c.status !== 'Prospective' && c.status !== 'Waitlist') return ''
    if (!c.incompleteForms?.length || c.allFormsComplete) {
      return 'User has completed all forms'
    }
    const count = c.incompleteForms.length
    const names = c.incompleteForms.map((k) => FORM_LABELS[k] ?? k).join(', ')
    return `${count} remaining: ${names}`
  }

  const toast = useToast()
  const updatingId = ref<string | null>(null)

  type StatusTransition = { from: ClientStatus; to: ClientStatus; label: string }

  const STATUS_TRANSITIONS: StatusTransition[] = [
    { from: 'Prospective', to: 'Waitlist', label: '-> Waitlist' },
    { from: 'Waitlist', to: 'Prospective', label: '-> Prospective' },
    { from: 'Waitlist', to: 'Active', label: '-> Active' },
    { from: 'Active', to: 'Archived', label: '-> Archive' },
    { from: 'Archived', to: 'Active', label: '-> Active' },
  ]

  function getAvailableTransitions(client: Client): StatusTransition[] {
    return STATUS_TRANSITIONS.filter((t) => {
      if (t.from !== client.status) return false
      if (t.from === 'Prospective' && t.to === 'Waitlist' && !client.allFormsComplete) {
        return false
      }
      if (t.from === 'Waitlist' && t.to === 'Active' && !client.allFormsComplete) {
        return false
      }
      return true
    })
  }

  const confirmModalOpen = ref(false)
  const pendingClient = ref<Client | null>(null)
  const pendingNextStatus = ref<ClientStatus | null>(null)

  const clientDetailModalOpen = ref(false)
  const selectedClientId = ref<string | null>(null)

  function openClientDetail(client: Client) {
    selectedClientId.value = client.id
    clientDetailModalOpen.value = true
  }

  function onTableRowSelect(_e: Event, row: TableRow<Client>) {
    openClientDetail(row.original)
  }

  const columns = computed<TableColumn<Client>[]>(() => {
    const cols: TableColumn<Client>[] = [
      { accessorKey: 'status', header: 'Status' },
      { id: 'name', header: 'Name' },
      { accessorKey: 'email', header: 'Email' },
    ]
    if (showFormsRemainingColumn.value) {
      cols.push({ id: 'formsRemaining', header: 'Forms remaining' })
    }
    if (showWeekNoColumn.value) {
      cols.push({ id: 'weekNo', header: 'Week no' })
    }
    cols.push({
      id: 'actions',
      header: 'Actions',
      meta: {
        class: {
          th: 'text-right',
          td: 'text-right',
        },
      },
    })
    return cols
  })

  function openConfirmModal(client: Client, nextStatus: ClientStatus) {
    pendingClient.value = client
    pendingNextStatus.value = nextStatus
    confirmModalOpen.value = true
  }

  function closeConfirmModal() {
    confirmModalOpen.value = false
    pendingClient.value = null
    pendingNextStatus.value = null
  }

  async function confirmStatusUpdate() {
    if (!pendingClient.value || !pendingNextStatus.value) {
      closeConfirmModal()
      return
    }
    await updateStatus(pendingClient.value.id, pendingNextStatus.value)
    closeConfirmModal()
  }

  const metricsModalOpen = ref(false)

  async function updateStatus(clientId: string, newStatus: ClientStatus) {
    if (updatingId.value) return
    try {
      updatingId.value = clientId
      await $fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      })
      toast.add({
        title: 'Status Updated',
        description: `Client moved to ${statusLabel(newStatus)}`,
        color: 'success',
      })
      await refreshClientsAndCounts()
    } catch (error: any) {
      const msg = error?.data?.statusMessage || error?.statusMessage || 'Failed to update status'
      toast.add({
        title: 'Update Failed',
        description: msg,
        color: 'error',
      })
    } finally {
      updatingId.value = null
    }
  }
</script>

<template>
  <main class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Clients
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Browse clients by status. Manage status and therapy progress.
        </p>
      </div>
      <div class="flex flex-col items-end gap-2">
        <NuxtLink
          to="/clients/session-notes-requests"
          class="text-primary-600 hover:text-primary-700 dark:text-primary-400 inline-flex items-center gap-2 text-sm font-medium"
        >
          Session note requests
          <UBadge v-if="pendingNoteRequestCount > 0" color="warning" variant="subtle" size="sm">
            {{ pendingNoteRequestCount }} pending
          </UBadge>
        </NuxtLink>
        <UButton
          label="View client metrics"
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-chart-bar"
          @click="metricsModalOpen = true"
        />
      </div>

      <UModal v-model:open="metricsModalOpen" title="Client Metrics">
        <template #body>
          <div
            class="min-h-40 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          />
        </template>
      </UModal>
    </div>

    <div
      class="rounded-xl border border-gray-200/90 bg-white p-6 shadow-sm ring-1 ring-gray-950/5 dark:border-gray-800 dark:bg-gray-900 dark:ring-white/10"
    >
      <div class="mb-5 flex items-center gap-2.5">
        <div
          class="bg-primary-500/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-400 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        >
          <UIcon name="i-heroicons-user-group-20-solid" class="h-5 w-5" />
        </div>
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">Client list</h2>
      </div>

      <nav
        class="mb-4 flex flex-wrap items-center justify-start gap-1"
        aria-label="Filter clients by status"
        role="tablist"
      >
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          role="tab"
          :aria-selected="statusFilter === tab.value"
          class="rounded-md px-3 py-1.5 text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-gray-400/50 focus-visible:outline-none dark:focus-visible:ring-gray-500/50"
          :class="
            statusFilter === tab.value
              ? 'bg-gray-100 font-semibold text-gray-950 dark:bg-gray-800 dark:text-white'
              : 'bg-transparent font-medium text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-400'
          "
          @click="statusFilter = tab.value"
        >
          {{ tab.label }} ({{ tab.count }})
        </button>
      </nav>

      <UAlert
        v-if="error"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Error loading clients"
        :description="error.message"
      />

      <div
        v-else
        class="mt-6 overflow-x-auto rounded-lg border border-gray-200/80 dark:border-gray-800"
      >
        <UTable
          :data="clients ?? []"
          :columns="columns"
          :loading="pending"
          loading-color="primary"
          :get-row-id="(row: Client) => row.id"
          empty="No clients found."
          class="w-full min-w-[500px]"
          :ui="{
            thead: 'bg-gray-50/95 dark:bg-gray-900/95',
            th: 'text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400',
          }"
          @select="onTableRowSelect"
        >
          <template #status-cell="{ row }">
            <div class="flex flex-col gap-1.5">
              <UBadge
                :color="
                  row.original.status === 'Prospective'
                    ? 'neutral'
                    : statusColor(row.original.status)
                "
                :variant="statusVariant(row.original.status)"
                size="md"
                :icon="statusIcon(row.original.status)"
                leading
                :class="[
                  'inline-flex w-fit font-medium',
                  row.original.status === 'Prospective' ? PROSPECTIVE_BADGE_CLASS : '',
                ]"
              >
                {{ statusLabel(row.original.status) }}
              </UBadge>
              <span v-if="statusHint(row.original)" :class="['text-sm', WARNING_TEXT_MUTED]">
                {{ statusHint(row.original) }}
              </span>
            </div>
          </template>
          <template #name-cell="{ row }">
            <span
              :class="[
                'font-medium',
                isPlaceholderDisplayName(row.original)
                  ? 'text-muted italic'
                  : 'text-gray-900 dark:text-white',
              ]"
            >
              {{ displayName(row.original) }}
            </span>
          </template>
          <template #email-cell="{ row }">
            <span
              class="text-muted block max-w-[14rem] truncate text-base sm:max-w-xs"
              :title="row.original.email"
            >
              {{ row.original.email }}
            </span>
          </template>
          <template #formsRemaining-cell="{ row }">
            <span
              :class="[
                'text-base',
                row.original.allFormsComplete
                  ? 'text-green-600 dark:text-green-400'
                  : WARNING_TEXT_MUTED,
              ]"
            >
              {{ formatIncompleteForms(row.original) }}
            </span>
          </template>
          <template #weekNo-cell="{ row }">
            <span class="text-base text-gray-600 dark:text-gray-400">
              {{
                row.original.status === 'Active' && row.original.therapyWeek !== null
                  ? `${row.original.therapyWeek} / 26`
                  : row.original.status === 'Active'
                    ? '—'
                    : ''
              }}
            </span>
          </template>
          <template #actions-cell="{ row }">
            <div v-if="updatingId !== row.original.id" class="flex flex-wrap justify-end gap-1.5">
              <UButton
                v-for="t in getAvailableTransitions(row.original)"
                :key="`${t.from}-${t.to}`"
                size="xs"
                variant="outline"
                color="primary"
                :label="t.label"
                @click="openConfirmModal(row.original, t.to)"
              />
            </div>
            <div v-else class="flex justify-end">
              <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-gray-400" />
            </div>
          </template>
        </UTable>
      </div>
    </div>

    <UModal
      v-model:open="confirmModalOpen"
      :title="`Move to ${pendingNextStatus ? statusLabel(pendingNextStatus) : ''}?`"
      :description="
        pendingClient
          ? `Move ${displayName(pendingClient)} to ${pendingNextStatus ? statusLabel(pendingNextStatus) : ''} status?`
          : ''
      "
      :ui="{ footer: 'justify-end' }"
    >
      <template #footer>
        <UButton label="Cancel" color="neutral" variant="outline" @click="closeConfirmModal()" />
        <UButton
          label="Confirm"
          color="primary"
          :loading="!!pendingClient && updatingId === pendingClient?.id"
          @click="confirmStatusUpdate()"
        />
      </template>
    </UModal>

    <ClientDetailModal
      :client-id="selectedClientId"
      :open="clientDetailModalOpen"
      @close="clientDetailModalOpen = false"
      @refreshed="refreshClientsAndCounts()"
    />
  </main>
</template>
