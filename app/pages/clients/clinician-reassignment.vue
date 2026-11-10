<script setup lang="ts">
  import { formatPersonDisplayName } from '~/utils/name'

  // REQ-F-05c: admin queue for clients whose clinician left (or who have none).
  definePageMeta({ middleware: 'admin-only' })

  type Match = {
    clinicianUserId: string
    clinicianName: string | null
    score: number
    matchedTagCount: number
    currentCaseload: number
  }

  type QueueItem = {
    clientId: string
    clientUserId: string
    clientName: string
    clientEmail: string
    status: 'INCOMPLETE' | 'WAITLIST' | 'ACTIVE' | 'ARCHIVED'
    reason: 'UNASSIGNED' | 'CLINICIAN_LEFT' | 'CLIENT_REQUESTED'
    previousClinicianName: string | null
    requestedAt: string | null
    requestReason: string | null
    recommendations: Match[]
  }

  type ClinicianOption = { id: string; name: string; email: string }

  const toast = useToast()

  const {
    data: queue,
    pending: loading,
    error,
    refresh,
  } = await useFetch<QueueItem[]>('/api/admin/reassignment-queue', {
    getCachedData: () => undefined,
  })

  const { data: clinicians } = await useFetch<ClinicianOption[]>('/api/clinicians')
  const clinicianItems = computed(() =>
    (clinicians.value ?? []).map((c) => ({ label: c.name || c.email, value: c.id }))
  )

  /** Manual pick per client (fail-safe when no recommendation fits). */
  const manualPick = ref<Record<string, string | undefined>>({})
  const savingFor = ref<string | null>(null)

  async function assign(item: QueueItem, clinicianUserId: string, clinicianLabel: string) {
    if (savingFor.value) return
    try {
      savingFor.value = item.clientUserId
      await $fetch(`/api/clients/${item.clientUserId}/clinician`, {
        method: 'PATCH',
        body: { clinicianUserId },
      })
      toast.add({
        title: 'Clinician assigned',
        description: `${displayName(item)} is now with ${clinicianLabel}.`,
        color: 'success',
      })
      await refresh()
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Assignment failed'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      savingFor.value = null
    }
  }

  function assignManual(item: QueueItem) {
    const id = manualPick.value[item.clientUserId]
    if (!id) return
    const label = clinicianItems.value.find((c) => c.value === id)?.label ?? 'the clinician'
    assign(item, id, label)
  }

  function displayName(item: QueueItem) {
    return formatPersonDisplayName(item.clientName || '') || item.clientEmail
  }

  function statusLabel(status: QueueItem['status']) {
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  function reasonLabel(item: QueueItem) {
    const who = item.previousClinicianName ? ` (${item.previousClinicianName})` : ''
    switch (item.reason) {
      case 'CLINICIAN_LEFT':
        return `Clinician left${who}`
      case 'CLIENT_REQUESTED':
        return `Client asked for a new therapist${who}`
      default:
        return 'No clinician assigned'
    }
  }

  function reasonColor(item: QueueItem) {
    if (item.reason === 'CLINICIAN_LEFT') return 'warning' as const
    if (item.reason === 'CLIENT_REQUESTED') return 'info' as const
    return 'neutral' as const
  }
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8">
      <NuxtLink
        to="/clients"
        class="text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4 inline-flex items-center gap-1 text-sm font-medium"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to clients
      </NuxtLink>
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Clinician reassignment
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Clients whose clinician left, who have no clinician, or who asked for a new therapist
        (active clients first). Suggestions are ranked by how well each clinician's tags match the
        client's. Assigning a new clinician removes the previous clinician's access.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load the reassignment queue"
      :description="String(error)"
    />

    <template v-else>
      <div v-if="loading" class="space-y-3">
        <USkeleton class="h-32 w-full" />
        <USkeleton class="h-32 w-full" />
      </div>
      <div
        v-else-if="!queue?.length"
        class="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900"
      >
        <p class="text-gray-600 dark:text-gray-400">Every client has a clinician.</p>
      </div>
      <ul v-else class="space-y-4">
        <li
          v-for="item in queue"
          :key="item.clientId"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="font-semibold text-gray-900 dark:text-white">{{ displayName(item) }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">{{ item.clientEmail }}</p>
              <p
                v-if="item.reason === 'CLIENT_REQUESTED' && item.requestedAt"
                class="mt-1 text-xs text-gray-500 dark:text-gray-400"
              >
                Requested {{ new Date(item.requestedAt).toLocaleDateString() }}. They keep their
                current clinician until you reassign.
              </p>
              <p
                v-if="item.requestReason"
                class="mt-1 text-sm whitespace-pre-line text-gray-700 italic dark:text-gray-300"
              >
                “{{ item.requestReason }}”
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge color="neutral" variant="outline">{{ statusLabel(item.status) }}</UBadge>
              <UBadge :color="reasonColor(item)" variant="subtle">
                {{ reasonLabel(item) }}
              </UBadge>
            </div>
          </div>

          <h3
            class="mb-2 text-xs font-medium tracking-wide text-gray-500 uppercase dark:text-gray-400"
          >
            Suggested clinicians
          </h3>
          <p
            v-if="!item.recommendations.length"
            class="mb-4 text-sm text-gray-600 dark:text-gray-400"
          >
            No other clinicians available.
          </p>
          <ul v-else class="mb-4 divide-y divide-gray-100 dark:divide-gray-800">
            <li
              v-for="(m, i) in item.recommendations"
              :key="m.clinicianUserId"
              class="flex flex-wrap items-center justify-between gap-3 py-2"
            >
              <div class="min-w-0 text-sm">
                <span class="font-medium text-gray-900 dark:text-white">
                  {{ i + 1 }}. {{ m.clinicianName || 'Unnamed clinician' }}
                </span>
                <span class="ml-2 text-gray-500 dark:text-gray-400">
                  {{ Math.round(m.score * 100) }}% match · {{ m.matchedTagCount }} shared
                  {{ m.matchedTagCount === 1 ? 'tag' : 'tags' }} · {{ m.currentCaseload }} active
                  {{ m.currentCaseload === 1 ? 'client' : 'clients' }}
                </span>
              </div>
              <UButton
                size="xs"
                color="primary"
                :variant="i === 0 ? 'solid' : 'soft'"
                :loading="savingFor === item.clientUserId"
                :disabled="savingFor !== null"
                @click="assign(item, m.clinicianUserId, m.clinicianName || 'the clinician')"
              >
                Assign
              </UButton>
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-2">
            <USelect
              v-model="manualPick[item.clientUserId]"
              :items="clinicianItems"
              placeholder="Or pick any clinician"
              class="min-w-[16rem]"
            />
            <UButton
              size="sm"
              variant="soft"
              :disabled="!manualPick[item.clientUserId] || savingFor !== null"
              @click="assignManual(item)"
            >
              Assign
            </UButton>
          </div>
        </li>
      </ul>
    </template>
  </main>
</template>
