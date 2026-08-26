<script setup lang="ts">
  const { data: statusData } = await useFetch<{
    status: string | null
    hasClient: boolean
    userId: string | null
  }>('/api/user/my-status', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const { data: profile, refresh: refreshProfile } = await useFetch(
    () => `/api/clients/${statusData.value?.userId}/profile`,
    {
      key: () => `client-profile-${statusData.value?.userId ?? 'none'}`,
      watch: [() => statusData.value?.userId],
      getCachedData: () => undefined,
    }
  )

  const toast = useToast()

  const sessionNotesAccess = computed(() => {
    const raw = profile.value?.sessionNotesAccess ?? {
      hasAccess: false,
      mode: null as 'full' | 'summary' | null,
      summaryText: null as string | null,
      hasPendingRequest: false,
    }
    const m = raw.mode
    let mode: 'full' | 'summary' | null = null
    if (typeof m === 'string') {
      const u = m.toLowerCase()
      if (u === 'full') mode = 'full'
      else if (u === 'summary') mode = 'summary'
    }
    return { ...raw, mode }
  })

  const sessionNotesRequests = computed(
    () =>
      (profile.value?.sessionNotesRequests ?? []) as {
        id: string
        requestKind: string
        status: string
        createdAt: string
        decidedAt: string | null
        signatureData: string
        rejectionReason: string | null
        approvedSummaryText: string | null
      }[]
  )

  const hasClient = computed(() => Boolean(statusData.value?.hasClient && statusData.value?.userId))

  const sessionNotesRequestModalOpen = ref(false)
  const sessionNotesRequestSubmitting = ref(false)

  async function submitSessionNotesRequest(payload: {
    requestKind: 'FULL' | 'SUMMARY'
    signatureData: string
    startDate: string | null
    endDate: string | null
  }) {
    const uid = statusData.value?.userId
    if (!uid) return
    try {
      sessionNotesRequestSubmitting.value = true
      await $fetch(`/api/clients/${uid}/session-notes-request`, {
        method: 'POST',
        body: payload,
      })
      sessionNotesRequestModalOpen.value = false
      toast.add({
        title: 'Request submitted',
        description:
          'An administrator will review your request. You will receive an email when there is a decision.',
        color: 'success',
      })
      await refreshProfile()
    } catch (error: any) {
      toast.add({
        title: 'Request failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
    } finally {
      sessionNotesRequestSubmitting.value = false
    }
  }

  function scrollToSessionNotes() {
    nextTick(() => {
      const el =
        document.getElementById('session-notes') ??
        document.getElementById('session-notes-summary') ??
        document.getElementById('session-notes-section')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }

  function onViewSessionNotesClick() {
    const access = sessionNotesAccess.value

    if (!access.hasAccess) {
      toast.add({
        title: 'Session notes not available yet',
        description:
          'Please tap Request records first. After an administrator approves your request, you can view your notes here.',
        color: 'warning',
      })
      return
    }

    scrollToSessionNotes()
  }
</script>

<template>
  <section v-if="hasClient" id="session-notes-section" class="mt-10 scroll-mt-24">
    <div
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <UIcon name="i-heroicons-document-text" class="h-5 w-5" />
            Session notes
          </h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Submit a records request to view your session notes or a clinician-prepared summary.
            Each request is logged and requires admin approval within 14 calendar days.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="primary"
            variant="solid"
            size="sm"
            icon="i-heroicons-paper-airplane"
            :disabled="sessionNotesAccess.hasPendingRequest"
            :label="sessionNotesAccess.hasPendingRequest ? 'Request pending' : 'Request records'"
            @click="sessionNotesRequestModalOpen = true"
          />
          <UButton
            variant="soft"
            color="primary"
            size="sm"
            icon="i-heroicons-eye"
            label="View session notes"
            @click="onViewSessionNotesClick"
          />
        </div>
      </div>

      <UBadge
        v-if="sessionNotesAccess.hasPendingRequest"
        color="warning"
        variant="subtle"
        class="mb-4"
      >
        You have a pending request — an administrator will email you when it is reviewed.
      </UBadge>

      <div
        v-if="sessionNotesRequests.length"
        class="border-t border-gray-200 pt-4 dark:border-gray-700"
      >
        <h3 class="mb-2 text-sm font-medium text-gray-900 dark:text-white">
          Records request history
        </h3>
        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li
            v-for="r in sessionNotesRequests"
            :key="r.id"
            class="flex flex-wrap gap-x-2 gap-y-1 border-b border-gray-100 pb-2 last:border-0 dark:border-gray-800"
          >
            <span>{{ new Date(r.createdAt).toLocaleString() }}</span>
            <span>—</span>
            <span>{{ r.requestKind === 'FULL' ? 'Full notes' : 'Summary' }}</span>
            <span>—</span>
            <UBadge
              :color="
                r.status === 'APPROVED' ? 'success' : r.status === 'REJECTED' ? 'error' : 'warning'
              "
              variant="subtle"
              size="xs"
            >
              {{ r.status }}
            </UBadge>
            <span v-if="r.status === 'REJECTED' && r.rejectionReason" class="w-full text-xs">
              Reason: {{ r.rejectionReason }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="
        sessionNotesAccess.hasAccess &&
        sessionNotesAccess.mode === 'summary' &&
        !sessionNotesAccess.summaryText
      "
      id="session-notes-summary"
      class="mt-6 scroll-mt-24"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">
        Your summary request was approved, but the summary text is not available yet. Please check
        back later or contact the clinic.
      </p>
    </div>

    <div
      v-else-if="
        sessionNotesAccess.hasAccess &&
        sessionNotesAccess.mode === 'summary' &&
        sessionNotesAccess.summaryText
      "
      id="session-notes-summary"
      class="mt-6 scroll-mt-24"
    >
      <h2
        class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
      >
        <UIcon name="i-heroicons-document-text" class="h-5 w-5" />
        Session notes summary
      </h2>
      <div
        class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <p class="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
          {{ sessionNotesAccess.summaryText }}
        </p>
      </div>
    </div>

    <div
      v-else-if="
        sessionNotesAccess.hasAccess &&
        sessionNotesAccess.mode === 'full' &&
        profile?.sessionNotes?.length
      "
      id="session-notes"
      class="mt-6 scroll-mt-24"
    >
      <h2
        class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
      >
        <UIcon name="i-heroicons-document-text" class="h-5 w-5" />
        My session notes
      </h2>
      <div class="space-y-3">
        <div
          v-for="note in profile.sessionNotes"
          :key="note.id"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-sm whitespace-pre-wrap text-gray-900 dark:text-gray-100">
            {{ note.content }}
          </p>
          <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {{ new Date(note.createdAt).toLocaleString() }}
          </p>
        </div>
      </div>
    </div>

    <div
      v-else-if="
        sessionNotesAccess.hasAccess &&
        sessionNotesAccess.mode === 'full' &&
        !profile?.sessionNotes?.length
      "
      id="session-notes"
      class="mt-6 scroll-mt-24"
    >
      <p class="text-sm text-gray-600 dark:text-gray-400">
        You have access to session notes, but none have been added yet.
      </p>
    </div>
  </section>
  <Teleport to="body">
    <SessionNotesRequestModal
      :open="sessionNotesRequestModalOpen"
      :loading="sessionNotesRequestSubmitting"
      @close="sessionNotesRequestModalOpen = false"
      @submit="submitSessionNotesRequest"
    />
  </Teleport>
</template>
