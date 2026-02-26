<script setup lang="ts">
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

  const { data: clients, pending, error, refresh } = await useFetch<Client[]>('/api/clients', {
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

  function statusColor(status: ClientStatus): 'neutral' | 'warning' | 'primary' | 'neutral' {
    const colors: Record<ClientStatus, 'neutral' | 'warning' | 'primary' | 'neutral'> = {
      INCOMPLETE: 'warning',
      WAITLIST: 'primary',
      ACTIVE: 'primary',
      ARCHIVED: 'neutral',
    }
    return colors[status]
  }

  function statusHint(c: Client): string {
    if (c.status === 'INCOMPLETE' && !c.allFormsComplete) {
      return 'To move to waitlist, need to complete all forms'
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
    if (c.status !== 'INCOMPLETE' || !c.incompleteForms?.length) return ''
    const count = c.incompleteForms.length
    const names = c.incompleteForms.map((k) => FORM_LABELS[k] ?? k).join(', ')
    return `${count} remaining: ${names}`
  }

  const toast = useToast()
  const updatingId = ref<string | null>(null)

  function statusUpdateOptionsFor(client: Client) {
    return [
      { label: 'Incomplete', value: 'INCOMPLETE' as ClientStatus },
      { label: 'Waitlist', value: 'WAITLIST' as ClientStatus },
      {
        label: 'Active',
        value: 'ACTIVE' as ClientStatus,
        disabled: client.status !== 'WAITLIST',
      },
      {
        label: 'Archived',
        value: 'ARCHIVED' as ClientStatus,
        disabled: client.status !== 'ACTIVE',
      },
    ]
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
        title: 'Status updated',
        description: `Client moved to ${statusLabel(newStatus)}`,
        color: 'success',
      })
      await refresh()
    } catch (error: any) {
      const msg =
        error?.data?.statusMessage || error?.statusMessage || 'Failed to update status'
      toast.add({
        title: 'Update failed',
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
          Filterable list of clients. Manage status and therapy progress.
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
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            Client list
          </h2>
        </div>
        <div class="flex items-center gap-3">
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            value-key="value"
            placeholder="Filter by status"
            class="min-w-[180px]"
          />
          <UBadge variant="subtle" color="primary" size="md">
            {{ clients?.length ?? 0 }} clients
          </UBadge>
        </div>
      </div>

      <div v-if="pending" class="space-y-4">
        <div v-for="i in 5" :key="i" class="flex items-center gap-4 border-b border-gray-200 py-4 dark:border-gray-800">
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
                  class="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Status
                </th>
                <th
                  class="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Name
                </th>
                <th
                  class="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Email
                </th>
                <th
                  v-if="showFormsRemainingColumn"
                  class="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Forms remaining
                </th>
                <th
                  v-if="showWeekNoColumn"
                  class="pb-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Week no
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
              <tr
                v-for="client in clients"
                :key="client.id"
                class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                <td class="py-4 pr-4">
                  <div class="flex flex-col gap-1">
                    <USelect
                      :model-value="client.status"
                      :items="statusUpdateOptionsFor(client)"
                      value-key="value"
                      size="xs"
                      class="w-28"
                      :disabled="updatingId === client.id"
                      @update:model-value="(v: string) => updateStatus(client.id, v as ClientStatus)"
                    />
                    <span
                      v-if="statusHint(client)"
                      class="text-xs text-amber-600 dark:text-amber-400"
                    >
                      {{ statusHint(client) }}
                    </span>
                  </div>
                </td>
                <td class="py-4 pr-4 font-medium text-gray-900 dark:text-white">
                  {{ displayName(client) }}
                </td>
                <td class="py-4 pr-4 text-sm text-gray-600 dark:text-gray-400">
                  {{ client.email }}
                </td>
                <td
                  v-if="showFormsRemainingColumn"
                  class="py-4 pr-4 text-sm text-amber-600 dark:text-amber-400"
                >
                  {{ formatIncompleteForms(client) }}
                </td>
                <td
                  v-if="showWeekNoColumn"
                  class="py-4 pr-4 text-sm text-gray-600 dark:text-gray-400"
                >
                  {{ client.status === 'ACTIVE' && client.therapyWeek !== null ? `${client.therapyWeek} / 26` : (client.status === 'ACTIVE' ? '—' : '') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="!clients?.length"
          class="py-12 text-center text-gray-500 dark:text-gray-400"
        >
          No clients found.
        </div>
      </div>
    </div>
  </main>
</template>
