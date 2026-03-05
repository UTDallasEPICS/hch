<script setup lang="ts">
  definePageMeta({ middleware: 'clients-admin' })

  type ClientStatus = 'INCOMPLETE' | 'WAITLIST' | 'ACTIVE' | 'ARCHIVED'

  const FORM_LABELS: Record<string, string> = {
    application: 'Application',
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

  const statusOptions = [
    { label: 'All', value: ALL_STATUS },
    { label: 'Incomplete', value: 'INCOMPLETE' },
    { label: 'Waitlist', value: 'WAITLIST' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Archived', value: 'ARCHIVED' },
  ]

  const queryParams = computed(() => {
    const params: Record<string, string> = {}
    if (statusFilter.value && statusFilter.value !== ALL_STATUS) params.status = statusFilter.value
    return params
  })

  const {
    data: clients,
    pending,
    error,
    refresh,
  } = await useFetch<Client[]>('/api/clients', {
    query: queryParams,
    watch: [queryParams],
    getCachedData: () => undefined,
  })

  function displayName(c: Client) {
    if (c.lname) return `${c.fname} ${c.lname}`
    return c.fname || c.name
  }

  function statusLabel(status: ClientStatus): string {
    const labels: Record<ClientStatus, string> = {
      INCOMPLETE: 'Incomplete',
      WAITLIST: 'Waitlist',
      ACTIVE: 'Active',
      ARCHIVED: 'Archived',
    }
    return labels[status]
  }

  function statusColor(
    status: ClientStatus
  ): 'warning' | 'primary' | 'success' | 'neutral' {
    const colors: Record<
      ClientStatus,
      'warning' | 'primary' | 'success' | 'neutral'
    > = {
      INCOMPLETE: 'warning',
      WAITLIST: 'primary',
      ACTIVE: 'success',
      ARCHIVED: 'neutral',
    }
    return colors[status]
  }

  function statusVariant(status: ClientStatus): 'soft' | 'outline' {
    return status === 'ARCHIVED' ? 'outline' : 'soft'
  }

  function statusIcon(status: ClientStatus): string {
    const icons: Record<ClientStatus, string> = {
      INCOMPLETE: 'i-heroicons-clock',
      WAITLIST: 'i-heroicons-queue-list',
      ACTIVE: 'i-heroicons-check-circle',
      ARCHIVED: 'i-heroicons-archive-box',
    }
    return icons[status]
  }

  function statusHint(c: Client): string {
    if (c.status === 'INCOMPLETE' && !c.allFormsComplete) {
      return 'To move to waitlist, need to complete the application form'
    }
    return ''
  }

  const showFormsRemainingColumn = computed(
    () => clients.value?.some((c) => c.status === 'INCOMPLETE') ?? false
  )

  const showWeekNoColumn = computed(
    () => clients.value?.some((c) => c.status === 'ACTIVE') ?? false
  )

  function formatIncompleteForms(c: Client): string {
    if (c.status !== 'INCOMPLETE') return ''
    if (!c.incompleteForms?.length || c.allFormsComplete) {
      return 'Congratulations! All forms complete'
    }
    const count = c.incompleteForms.length
    const names = c.incompleteForms.map((k) => FORM_LABELS[k] ?? k).join(', ')
    return `${count} remaining: ${names}`
  }

  const toast = useToast()
  const updatingId = ref<string | null>(null)

  type StatusTransition = { from: ClientStatus; to: ClientStatus; label: string }

  const STATUS_TRANSITIONS: StatusTransition[] = [
    { from: 'INCOMPLETE', to: 'WAITLIST', label: '→ Waitlist' },
    { from: 'WAITLIST', to: 'INCOMPLETE', label: '→ Incomplete' },
    { from: 'WAITLIST', to: 'ACTIVE', label: '→ Active' },
    { from: 'ACTIVE', to: 'WAITLIST', label: '→ Waitlist' },
    { from: 'ACTIVE', to: 'ARCHIVED', label: '→ Archive' },
    { from: 'ARCHIVED', to: 'ACTIVE', label: '→ Active' },
  ]

  function getAvailableTransitions(client: Client): StatusTransition[] {
    return STATUS_TRANSITIONS.filter((t) => {
      if (t.from !== client.status) return false
      if (t.from === 'INCOMPLETE' && t.to === 'WAITLIST' && !client.allFormsComplete) return false
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
      await refresh()
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
  <main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Clients
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Filterable List of Clients. Manage Status and Therapy Progress.
        </p>
      </div>
    </div>

    <div
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-2">
          <UIcon
            name="i-heroicons-user-group-20-solid"
            class="h-5 w-5 text-gray-500 dark:text-gray-400"
          />
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Client List</h2>
        </div>
        <div class="flex items-center gap-3">
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            value-key="value"
            placeholder="Filter by Status"
            class="min-w-[180px]"
          />
          <UBadge variant="subtle" color="primary" size="md">
            {{ clients?.length ?? 0 }} clients
          </UBadge>
        </div>
      </div>

      <div v-if="pending" class="space-y-4">
        <div
          v-for="i in 5"
          :key="i"
          class="flex items-center gap-4 border-b border-gray-200 py-4 dark:border-gray-800"
        >
          <USkeleton class="h-10 w-10 rounded-full" />
          <div class="flex-1 space-y-2">
            <USkeleton class="h-4 w-48" />
            <USkeleton class="h-3 w-32" />
          </div>
        </div>
      </div>

      <div v-else-if="error">
        <UAlert
          icon="i-heroicons-exclamation-triangle-20-solid"
          color="error"
          variant="subtle"
          title="Error loading clients"
          :description="error.message"
        />
      </div>

      <div v-else>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[500px]">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-800">
                <th
                  class="pr-4 pb-3 text-left text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Status
                </th>
                <th
                  class="pr-4 pb-3 text-left text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Name
                </th>
                <th
                  class="pr-4 pb-3 text-left text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Email
                </th>
                <th
                  v-if="showFormsRemainingColumn"
                  class="pr-4 pb-3 text-left text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Forms remaining
                </th>
                <th
                  v-if="showWeekNoColumn"
                  class="pr-4 pb-3 text-left text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Week no
                </th>
                <th
                  class="w-0 pb-3 pr-4 text-right text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
              <tr
                v-for="client in clients"
                :key="client.id"
                class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                @click="openClientDetail(client)"
              >
                <td class="py-4 pr-4">
                  <div class="flex flex-col gap-1.5">
                    <UBadge
                      :color="statusColor(client.status)"
                      :variant="statusVariant(client.status)"
                      size="md"
                      :icon="statusIcon(client.status)"
                      leading
                      class="inline-flex w-fit font-medium"
                    >
                      {{ statusLabel(client.status) }}
                    </UBadge>
                    <span
                      v-if="statusHint(client)"
                      class="text-sm text-amber-600 dark:text-amber-400"
                    >
                      {{ statusHint(client) }}
                    </span>
                  </div>
                </td>
                <td class="py-4 pr-4 font-medium text-gray-900 dark:text-white">
                  {{ displayName(client) }}
                </td>
                <td class="py-4 pr-4 text-base text-gray-600 dark:text-gray-400">
                  {{ client.email }}
                </td>
                <td
                  v-if="showFormsRemainingColumn"
                  :class="[
                    'py-4 pr-4 text-base',
                    client.allFormsComplete
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-amber-600 dark:text-amber-400',
                  ]"
                >
                  {{ formatIncompleteForms(client) }}
                </td>
                <td
                  v-if="showWeekNoColumn"
                  class="py-4 pr-4 text-base text-gray-600 dark:text-gray-400"
                >
                  {{
                    client.status === 'ACTIVE' && client.therapyWeek !== null
                      ? `${client.therapyWeek} / 26`
                      : client.status === 'ACTIVE'
                        ? '—'
                        : ''
                  }}
                </td>
                <td class="py-4 pr-4 text-right" @click.stop>
                  <div
                    v-if="updatingId !== client.id"
                    class="flex flex-wrap justify-end gap-1.5"
                  >
                    <UButton
                      v-for="t in getAvailableTransitions(client)"
                      :key="`${t.from}-${t.to}`"
                      size="xs"
                      variant="outline"
                      color="primary"
                      :label="t.label"
                      @click="openConfirmModal(client, t.to)"
                    />
                  </div>
                  <div v-else class="flex justify-end">
                    <UIcon name="i-heroicons-arrow-path" class="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="!clients?.length" class="py-12 text-center text-gray-500 dark:text-gray-400">
          No clients found.
        </div>
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
      @refreshed="refresh()"
    />
  </main>
</template>
