<script setup lang="ts">
  import { formatPersonDisplayName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  type Row = {
    id: string
    clientUserId: string
    clientName: string
    clientEmail: string
    requestedStartTime: string
    requestedEndTime: string
    message: string | null
    status: string
    createdAt: string
    decidedAt: string | null
    staffResponseNote: string | null
    createdAppointmentId: string | null
  }

  type QueueResponse = {
    pending: Row[]
    history: Row[]
  }

  const toast = useToast()

  const {
    data: queue,
    pending: loading,
    error,
    refresh,
  } = await useFetch<QueueResponse>('/api/appointment-schedule-requests', {
    getCachedData: () => undefined,
  })

  const decideModalOpen = ref(false)
  const selected = ref<Row | null>(null)
  const decideAction = ref<'accept' | 'deny' | null>(null)
  const staffResponseNote = ref('')
  const deciding = ref(false)

  function openDecide(r: Row, action: 'accept' | 'deny') {
    selected.value = r
    decideAction.value = action
    staffResponseNote.value = ''
    decideModalOpen.value = true
  }

  async function submitDecision() {
    if (!selected.value || !decideAction.value) return
    const id = selected.value.id

    if (decideAction.value === 'deny' && staffResponseNote.value.trim().length < 3) {
      toast.add({
        title: 'Explanation required',
        description: 'Please explain why this time cannot be scheduled.',
        color: 'error',
      })
      return
    }

    try {
      deciding.value = true
      await $fetch(`/api/appointment-schedule-requests/${id}`, {
        method: 'PATCH',
        body:
          decideAction.value === 'deny'
            ? { action: 'deny', staffResponseNote: staffResponseNote.value }
            : { action: 'accept' },
      })
      toast.add({
        title: decideAction.value === 'accept' ? 'Session scheduled' : 'Request declined',
        description:
          decideAction.value === 'accept'
            ? 'The client has been notified.'
            : 'The client has been notified with your message.',
        color: 'success',
      })
      decideModalOpen.value = false
      selected.value = null
      decideAction.value = null
      await refresh()
    } catch (e: unknown) {
      const msg =
        (e as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Action failed'
      toast.add({ title: 'Error', description: msg, color: 'error' })
    } finally {
      deciding.value = false
    }
  }

  function displayName(r: Row) {
    return formatPersonDisplayName(r.clientName || '')
  }

  function formatRange(startIso: string, endIso: string) {
    const start = new Date(startIso)
    const end = new Date(endIso)
    const dateStr = start.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }
    return `${dateStr} · ${start.toLocaleTimeString(undefined, timeOpts)} – ${end.toLocaleTimeString(undefined, timeOpts)}`
  }

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
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
        Session time requests
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Clients propose visit times from their dashboard. Accepting creates a confirmed appointment
        on the calendar; denying notifies the client with your message.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load requests"
      :description="String(error)"
    />

    <template v-else>
      <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Pending</h2>
      <div v-if="loading" class="space-y-3">
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>
      <div
        v-else-if="!(queue?.pending?.length)"
        class="mb-10 rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900"
      >
        <p class="text-gray-600 dark:text-gray-400">No pending session time requests.</p>
      </div>
      <ul v-else class="mb-10 space-y-4">
        <li
          v-for="r in queue!.pending"
          :key="r.id"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ displayName(r) }}
              </h3>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ r.clientEmail }}</p>
              <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                {{ formatRange(r.requestedStartTime, r.requestedEndTime) }}
              </p>
              <p v-if="r.message" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ r.message }}
              </p>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Submitted {{ formatDateTime(r.createdAt) }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <UButton size="sm" color="success" variant="soft" @click="openDecide(r, 'accept')">
                Accept
              </UButton>
              <UButton size="sm" color="error" variant="soft" @click="openDecide(r, 'deny')">
                Deny
              </UButton>
            </div>
          </div>
        </li>
      </ul>

      <h2 class="mb-3 text-base font-semibold text-gray-900 dark:text-white">Recent decisions</h2>
      <div
        v-if="!loading && !(queue?.history?.length)"
        class="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900"
      >
        <p class="text-sm text-gray-600 dark:text-gray-400">No recent decisions yet.</p>
      </div>
      <ul v-else-if="queue?.history?.length" class="space-y-3">
        <li
          v-for="r in queue!.history"
          :key="r.id"
          class="rounded-lg border border-gray-100 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/60"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium text-gray-900 dark:text-white">{{ displayName(r) }}</span>
            <UBadge
              :color="r.status === 'ACCEPTED' ? 'success' : 'error'"
              variant="subtle"
              size="sm"
            >
              {{ r.status === 'ACCEPTED' ? 'Accepted' : 'Denied' }}
            </UBadge>
          </div>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ formatRange(r.requestedStartTime, r.requestedEndTime) }}
          </p>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {{ formatDateTime(r.decidedAt) }}
          </p>
        </li>
      </ul>
    </template>

    <UModal
      :open="decideModalOpen"
      :title="decideAction === 'accept' ? 'Accept and schedule' : 'Decline request'"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (decideModalOpen = false)"
    >
      <template #body>
        <div v-if="selected" class="space-y-4 p-6">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            <span class="font-medium text-gray-900 dark:text-white">{{ displayName(selected) }}</span>
            · {{ formatRange(selected.requestedStartTime, selected.requestedEndTime) }}
          </p>

          <template v-if="decideAction === 'deny'">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              This message is emailed to the client.
            </p>
            <UFormField label="Reason" required>
              <UTextarea v-model="staffResponseNote" :rows="5" class="w-full" placeholder="Required" />
            </UFormField>
          </template>

          <template v-else>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              A calendar appointment will be created for this exact time range, and the client will
              be notified.
            </p>
          </template>

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="decideModalOpen = false">Cancel</UButton>
            <UButton
              :color="decideAction === 'deny' ? 'error' : 'success'"
              :loading="deciding"
              @click="submitDecision"
            >
              {{ decideAction === 'deny' ? 'Deny & notify' : 'Accept & schedule' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>
