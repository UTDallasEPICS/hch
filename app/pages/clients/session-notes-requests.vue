<script setup lang="ts">
  import { formatPersonDisplayName } from '~/utils/name'

  definePageMeta({ middleware: 'clients-admin' })

  type PendingRequest = {
    id: string
    requestKind: 'FULL' | 'SUMMARY'
    status: string
    createdAt: string
    declarationText: string
    signatureData: string
    clientUserId: string
    clientName: string
    clientEmail: string
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
  const approvedSummaryText = ref('')
  const deciding = ref(false)

  function openDecide(r: PendingRequest, action: 'approve' | 'reject') {
    selected.value = r
    decideAction.value = action
    rejectionReason.value = ''
    approvedSummaryText.value = ''
    decideModalOpen.value = true
  }

  async function submitDecision() {
    if (!selected.value || !decideAction.value) return
    const id = selected.value.id
    try {
      deciding.value = true
      if (decideAction.value === 'reject') {
        await $fetch(`/api/session-notes-requests/${id}`, {
          method: 'PATCH',
          body: { action: 'reject', rejectionReason: rejectionReason.value },
        })
        toast.add({ title: 'Request rejected', description: 'The client has been notified.', color: 'success' })
      } else {
        await $fetch(`/api/session-notes-requests/${id}`, {
          method: 'PATCH',
          body: {
            action: 'approve',
            approvedSummaryText:
              selected.value.requestKind === 'SUMMARY' ? approvedSummaryText.value : undefined,
          },
        })
        toast.add({ title: 'Request approved', description: 'The client has been notified.', color: 'success' })
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

  /** e.g. "Submitted March 25, 2026 at 4:34 PM" */
  function formatSubmittedAt(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const datePart = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
    const timePart = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d)
    return `Submitted ${datePart} at ${timePart}`
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
        Session note requests
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Pending client requests to view session notes or a summary. Approve or reject each request.
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
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <div v-else-if="!pending?.length" class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">
      <p class="text-gray-600 dark:text-gray-400">No pending session note requests.</p>
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
            <p class="mt-5 text-sm text-gray-700 dark:text-gray-300">
              <span class="font-medium">Type:</span>
              {{ r.requestKind === 'FULL' ? 'Full session notes' : 'Summary only' }}
            </p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ formatSubmittedAt(r.createdAt) }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton size="sm" color="success" variant="soft" @click="openDecide(r, 'approve')">
              Approve
            </UButton>
            <UButton size="sm" color="error" variant="soft" @click="openDecide(r, 'reject')">
              Reject
            </UButton>
          </div>
        </div>
        <details class="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <summary class="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
            Declaration & signature (compliance)
          </summary>
          <p class="mt-2 text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-400">
            {{ r.declarationText }}
          </p>
          <div class="mt-3 overflow-x-auto rounded border border-gray-200 bg-white p-2 dark:border-gray-700">
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
      :title="decideAction === 'approve' ? 'Approve request' : 'Reject request'"
      :ui="{ content: 'max-w-lg w-full' }"
      @update:open="(v: boolean) => !v && (decideModalOpen = false)"
    >
      <template #body>
        <div v-if="selected" class="space-y-4 p-6">
          <p v-if="decideAction === 'reject'" class="text-sm text-gray-600 dark:text-gray-400">
            Explain why this request cannot be approved. This message is emailed to the client.
          </p>
          <UFormField v-if="decideAction === 'reject'" label="Reason" required>
            <UTextarea v-model="rejectionReason" :rows="5" class="w-full" placeholder="Required" />
          </UFormField>
          <template v-if="decideAction === 'approve' && selected.requestKind === 'SUMMARY'">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Enter the summary text the client is allowed to see (this is not the full clinical
              record).
            </p>
            <UFormField label="Approved summary" required>
              <UTextarea v-model="approvedSummaryText" :rows="8" class="w-full" placeholder="Summary text" />
            </UFormField>
          </template>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="decideModalOpen = false">Cancel</UButton>
            <UButton
              :color="decideAction === 'reject' ? 'error' : 'success'"
              :loading="deciding"
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
