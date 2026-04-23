<script setup lang="ts">
  import type { ChangeJustificationPayload } from '~/components/ChangeWithJustificationModal.vue'

  definePageMeta({ middleware: 'clients-admin' })

  type PendingApproval = {
    id: string
    clientUserId: string | null
    clientName: string
    clientEmail: string | null
    sessionName: string
    sessionNumber: number
    kind: 'PROGRESS' | 'PSYCHOTHERAPY'
    status: 'CLINICIAN_SIGNED'
    content: string
    attended: boolean
    appointmentId: string | null
    appointmentStartTime: string | null
    clinicianSignedAt: string | null
    clinicianSignatureData: string | null
    clinicianUserId: string | null
    clinicianName: string | null
    createdAt: string
    updatedAt: string
  }

  const toast = useToast()
  const { data: roleData } = await useFetch<{ isAdmin: boolean }>(
    '/api/users/me/is-admin',
    {
      getCachedData: (key, nuxtApp) =>
        nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    }
  )
  const isAdminViewer = computed(() => roleData.value?.isAdmin === true)

  /** Bounce clinicians away from an admin-only queue – the middleware allows all staff. */
  watchEffect(() => {
    if (roleData.value && !isAdminViewer.value) {
      navigateTo('/', { replace: true })
    }
  })

  const kindFilter = ref<'all' | 'PROGRESS' | 'PSYCHOTHERAPY'>('all')

  const {
    data,
    pending,
    error,
    refresh,
  } = await useFetch<PendingApproval[]>(
    () => {
      const qs = kindFilter.value === 'all' ? '' : `?kind=${kindFilter.value}`
      return `/api/session-notes/pending-approvals${qs}`
    },
    {
      watch: [kindFilter],
      getCachedData: () => undefined,
    }
  )

  const approveModalOpen = ref(false)
  const selected = ref<PendingApproval | null>(null)
  const approving = ref(false)

  function openApprove(row: PendingApproval) {
    selected.value = row
    approveModalOpen.value = true
  }

  async function onApprove(payload: ChangeJustificationPayload) {
    if (!selected.value) return
    const row = selected.value
    if (!row.clientUserId) {
      toast.add({ title: 'Missing client', description: 'Cannot resolve client.', color: 'error' })
      return
    }
    try {
      approving.value = true
      await $fetch(
        `/api/clients/${row.clientUserId}/session-notes/${row.id}/approve`,
        {
          method: 'POST',
          body: {
            adminSignatureData: payload.signatureData,
            approvalNote: payload.reasoning,
          },
        }
      )
      toast.add({
        title: 'Note approved',
        description: 'The clinician has been notified.',
        color: 'success',
      })
      approveModalOpen.value = false
      selected.value = null
      await refresh()
    } catch (e: unknown) {
      toast.add({
        title: 'Approval failed',
        description:
          (e as { data?: { statusMessage?: string } })?.data?.statusMessage ??
          'Could not approve. Try again.',
        color: 'error',
      })
    } finally {
      approving.value = false
    }
  }

  function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleString('en-US')
  }

  const kindLabel = (k: 'PROGRESS' | 'PSYCHOTHERAPY') =>
    k === 'PSYCHOTHERAPY' ? 'Psychotherapy note' : 'Progress note'
</script>

<template>
  <main class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <div class="mb-8">
      <NuxtLink
        to="/"
        class="text-primary-600 hover:text-primary-700 dark:text-primary-400 mb-4 inline-flex items-center gap-1 text-sm font-medium"
      >
        <UIcon name="i-heroicons-arrow-left" class="h-4 w-4" />
        Back to dashboard
      </NuxtLink>
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        Session note approvals
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Clinician-signed notes awaiting your final sign-off. Approving a note sends a confirmation
        notification back to the clinician who wrote it.
      </p>
    </div>

    <!-- Kind filter -->
    <div
      class="mb-6 flex w-fit gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-medium dark:border-gray-700 dark:bg-gray-900"
    >
      <button
        type="button"
        class="rounded-md px-3 py-1.5 transition-colors"
        :class="
          kindFilter === 'all'
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
        "
        @click="kindFilter = 'all'"
      >
        All
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 transition-colors"
        :class="
          kindFilter === 'PROGRESS'
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
        "
        @click="kindFilter = 'PROGRESS'"
      >
        Progress notes
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 transition-colors"
        :class="
          kindFilter === 'PSYCHOTHERAPY'
            ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
            : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800'
        "
        @click="kindFilter = 'PSYCHOTHERAPY'"
      >
        Psychotherapy notes
      </button>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Could not load approvals"
      :description="String(error)"
    />

    <div v-else-if="pending" class="space-y-3">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <div
      v-else-if="!data?.length"
      class="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="text-gray-600 dark:text-gray-400">No notes awaiting approval.</p>
    </div>

    <ul v-else class="space-y-4">
      <li
        v-for="n in data"
        :key="n.id"
        class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ n.clientName }}
              </h2>
              <UBadge color="warning" variant="subtle" size="sm">Clinician Signed</UBadge>
              <UBadge
                :color="n.kind === 'PSYCHOTHERAPY' ? 'secondary' : 'primary'"
                variant="subtle"
                size="sm"
              >
                {{ kindLabel(n.kind) }}
              </UBadge>
              <UBadge v-if="!n.attended" color="error" variant="subtle" size="sm">Absent</UBadge>
            </div>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ n.sessionName }} · signed by {{ n.clinicianName || 'clinician' }}
              {{ formatDateTime(n.clinicianSignedAt) }}
            </p>
            <div class="mt-3 max-h-48 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm whitespace-pre-wrap dark:border-gray-700 dark:bg-gray-800">
              {{ n.content }}
            </div>
            <details v-if="n.clinicianSignatureData" class="mt-3 text-sm">
              <summary class="cursor-pointer text-gray-600 dark:text-gray-400">
                View clinician signature
              </summary>
              <img
                :src="n.clinicianSignatureData"
                alt="Clinician signature"
                class="mt-2 max-h-32 rounded border border-gray-200 bg-white p-2 dark:border-gray-700"
              />
            </details>
          </div>
          <div class="flex flex-shrink-0 flex-col items-end gap-2">
            <UButton
              color="success"
              variant="solid"
              size="sm"
              icon="i-heroicons-check-badge"
              label="Approve & sign"
              @click="openApprove(n)"
            />
            <NuxtLink
              v-if="n.clientUserId"
              :to="`/clients/${n.clientUserId}/notes-editor?focus=${encodeURIComponent(n.id)}`"
              class="text-primary-600 hover:text-primary-700 dark:text-primary-400 text-xs font-medium"
            >
              Open in editor
            </NuxtLink>
          </div>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <ChangeWithJustificationModal
        :open="approveModalOpen"
        title="Admin approval – final sign-off"
        :description="
          selected
            ? `You are counter-signing the ${kindLabel(selected.kind).toLowerCase()} for ${selected.clientName}. This is the final tier of approval. The clinician will be notified once you sign.`
            : ''
        "
        submit-label="Sign & approve"
        :loading="approving"
        signature-only
        @close="approveModalOpen = false"
        @submit="onApprove"
      />
    </Teleport>
  </main>
</template>
