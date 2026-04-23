<script setup lang="ts">
  import { formatPersonDisplayName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  type PendingRequest = {
    id: string
    requestKind: 'FULL' | 'SUMMARY'
    status: string
    createdAt: string
    startDate: string | null
    endDate: string | null
    declarationText: string
    signatureData: string
    clientUserId: string
    clientName: string
    clientEmail: string
    approvalWindowDays: number
    approvalExpiresAt: string
  }

  const toast = useToast()

  const {
    data: pending,
    pending: loading,
    error,
    refresh,
  } = await useFetch<PendingRequest[]>('/api/session-notes-requests', {
    getCachedData: () => undefined,
  })

  const decideModalOpen = ref(false)
  const selected = ref<PendingRequest | null>(null)
  const decideAction = ref<'approve' | 'reject' | null>(null)
  const rejectionReason = ref('')
  const approvalReason = ref('')
  const approvedSummaryText = ref('')
  const deciding = ref(false)

  /** Ticking "now" so the Time-Left countdowns update live without re-fetching. */
  const nowMs = ref(Date.now())
  let tickTimer: ReturnType<typeof setInterval> | null = null
  onMounted(() => {
    tickTimer = setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
  })
  onBeforeUnmount(() => {
    if (tickTimer) clearInterval(tickTimer)
  })

  function openDecide(r: PendingRequest, action: 'approve' | 'reject') {
    selected.value = r
    decideAction.value = action
    rejectionReason.value = ''
    approvalReason.value = ''
    approvedSummaryText.value = ''
    decideModalOpen.value = true
  }

  async function submitDecision() {
    if (!selected.value || !decideAction.value) return
    const id = selected.value.id

    if (decideAction.value === 'approve') {
      if (approvalReason.value.trim().length < 3) {
        toast.add({
          title: 'Reason required',
          description: 'Please enter a reason for approval (at least a few characters).',
          color: 'error',
        })
        return
      }
      if (selected.value.requestKind === 'SUMMARY' && approvedSummaryText.value.trim().length < 5) {
        toast.add({
          title: 'Summary too short',
          description: 'Approved summary must be at least 5 characters.',
          color: 'error',
        })
        return
      }
    } else if (decideAction.value === 'reject' && rejectionReason.value.trim().length < 3) {
      toast.add({
        title: 'Reason required',
        description: 'Please explain why this request is being rejected.',
        color: 'error',
      })
      return
    }

    try {
      deciding.value = true
      if (decideAction.value === 'reject') {
        await $fetch(`/api/session-notes-requests/${id}`, {
          method: 'PATCH',
          body: { action: 'reject', rejectionReason: rejectionReason.value },
        })
        toast.add({
          title: 'Request rejected',
          description: 'The client has been notified.',
          color: 'success',
        })
      } else {
        await $fetch(`/api/session-notes-requests/${id}`, {
          method: 'PATCH',
          body: {
            action: 'approve',
            approvalReason: approvalReason.value,
            approvedSummaryText:
              selected.value.requestKind === 'SUMMARY' ? approvedSummaryText.value : undefined,
          },
        })
        toast.add({
          title: 'Request approved',
          description: 'The client has been notified.',
          color: 'success',
        })
      }
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

  function displayName(r: PendingRequest) {
    return formatPersonDisplayName(r.clientName || '')
  }

  /** e.g. "March 25, 2026 at 4:34 PM" */
  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const datePart = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
    return `${datePart} at ${timePart}`
  }

  function formatDateOnly(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  }

  function formatRequestedRange(r: PendingRequest): string {
    if (!r.startDate && !r.endDate) return 'Entire available record'
    return `${formatDateOnly(r.startDate)} – ${formatDateOnly(r.endDate)}`
  }

  /** Returns the remaining approval window in ms (negative if already expired). */
  function msLeft(r: PendingRequest): number {
    return new Date(r.approvalExpiresAt).getTime() - nowMs.value
  }

  function isExpired(r: PendingRequest): boolean {
    return msLeft(r) <= 0
  }

  /** e.g. "12d 03:47:12" or "Expired" */
  function formatCountdown(r: PendingRequest): string {
    const ms = msLeft(r)
    if (ms <= 0) return 'Expired'
    const totalSec = Math.floor(ms / 1000)
    const days = Math.floor(totalSec / 86400)
    const hours = Math.floor((totalSec % 86400) / 3600)
    const mins = Math.floor((totalSec % 3600) / 60)
    const secs = totalSec % 60
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
  }

  function countdownColor(r: PendingRequest): 'success' | 'warning' | 'error' {
    const ms = msLeft(r)
    if (ms <= 0) return 'error'
    const dayMs = 24 * 60 * 60 * 1000
    if (ms < 3 * dayMs) return 'warning'
    return 'success'
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
        Records requests
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Pending client requests to view session notes or a summary. Approve or reject each request
        within 14 calendar days of the submission date.
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load requests"
      :description="String(error)"
    />

    <div v-else-if="loading" class="space-y-3">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <div
      v-else-if="!pending?.length"
      class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="text-gray-600 dark:text-gray-400">No pending records requests.</p>
    </div>

    <ul v-else class="space-y-4">
      <li
        v-for="r in pending"
        :key="r.id"
        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
              {{ displayName(r) }}
            </h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ r.clientEmail }}</p>
            <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div class="flex flex-col">
                <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Type</dt>
                <dd class="text-gray-700 dark:text-gray-300">
                  {{ r.requestKind === 'FULL' ? 'Full session notes' : 'Summary only' }}
                </dd>
              </div>
              <div class="flex flex-col">
                <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Requested range</dt>
                <dd class="text-gray-700 dark:text-gray-300">
                  {{ formatRequestedRange(r) }}
                </dd>
              </div>
              <div class="flex flex-col">
                <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Date of request</dt>
                <dd class="text-gray-700 dark:text-gray-300">
                  {{ formatDateTime(r.createdAt) }}
                </dd>
              </div>
              <div class="flex flex-col">
                <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Time left to approve (14 days)
                </dt>
                <dd>
                  <UBadge :color="countdownColor(r)" variant="subtle" size="sm">
                    <UIcon name="i-heroicons-clock" class="mr-1 h-3.5 w-3.5" />
                    {{ formatCountdown(r) }}
                  </UBadge>
                  <span class="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    expires {{ formatDateTime(r.approvalExpiresAt) }}
                  </span>
                </dd>
              </div>
            </dl>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              color="success"
              variant="soft"
              :disabled="isExpired(r)"
              @click="openDecide(r, 'approve')"
            >
              Approve
            </UButton>
            <UButton size="sm" color="error" variant="soft" @click="openDecide(r, 'reject')">
              Reject
            </UButton>
          </div>
        </div>
        <details class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            Declaration &amp; signature (compliance)
          </summary>
          <p class="mt-2 text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-400">
            {{ r.declarationText }}
          </p>
          <div
            class="mt-3 overflow-x-auto rounded border border-gray-200 bg-white p-2 dark:border-gray-700"
          >
            <img
              :src="r.signatureData"
              alt="Client digital signature"
              class="max-h-40 w-auto max-w-full"
            />
          </div>
        </details>
      </li>
    </ul>

    <UModal
      :open="decideModalOpen"
      :title="decideAction === 'approve' ? 'Approve records request' : 'Reject records request'"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (decideModalOpen = false)"
    >
      <template #body>
        <div v-if="selected" class="space-y-4 p-6">
          <!-- Summary of the request being decided -->
          <dl class="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-gray-200 p-3 text-sm sm:grid-cols-2 dark:border-gray-700">
            <div class="flex flex-col">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Client name</dt>
              <dd class="font-medium text-gray-900 dark:text-white">
                {{ displayName(selected) }}
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Date of request</dt>
              <dd class="text-gray-700 dark:text-gray-300">
                {{ formatDateTime(selected.createdAt) }}
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Date approved
              </dt>
              <dd class="text-gray-700 dark:text-gray-300">
                {{ decideAction === 'approve' ? formatDateTime(new Date().toISOString()) : '—' }}
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Time left to approve
              </dt>
              <dd>
                <UBadge :color="countdownColor(selected)" variant="subtle" size="sm">
                  <UIcon name="i-heroicons-clock" class="mr-1 h-3.5 w-3.5" />
                  {{ formatCountdown(selected) }}
                </UBadge>
              </dd>
            </div>
            <div class="flex flex-col sm:col-span-2">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Requested range</dt>
              <dd class="text-gray-700 dark:text-gray-300">
                {{ formatRequestedRange(selected) }}
              </dd>
            </div>
          </dl>

          <template v-if="decideAction === 'reject'">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Explain why this request cannot be approved. This message is emailed to the client.
            </p>
            <UFormField label="Reason for rejection" required>
              <UTextarea
                v-model="rejectionReason"
                :rows="5"
                class="w-full"
                placeholder="Required"
              />
            </UFormField>
          </template>

          <template v-if="decideAction === 'approve'">
            <UFormField label="Reason for approval" required>
              <UTextarea
                v-model="approvalReason"
                :rows="4"
                class="w-full"
                placeholder="e.g. Routine records request; identity confirmed; no safety concerns."
              />
            </UFormField>

            <template v-if="selected.requestKind === 'SUMMARY'">
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Enter the summary text the client is allowed to see (this is not the full clinical
                record).
              </p>
              <UFormField
                label="Approved summary"
                required
                help="Minimum 5 characters."
              >
                <UTextarea
                  v-model="approvedSummaryText"
                  :rows="8"
                  class="w-full"
                  placeholder="Summary text"
                />
              </UFormField>
            </template>
          </template>

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="decideModalOpen = false">Cancel</UButton>
            <UButton
              :color="decideAction === 'reject' ? 'error' : 'success'"
              :loading="deciding"
              :disabled="decideAction === 'approve' && isExpired(selected)"
              @click="submitDecision"
            >
              {{ decideAction === 'reject' ? 'Reject & notify' : 'Approve & notify' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>
