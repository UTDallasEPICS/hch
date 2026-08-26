<script setup lang="ts">
  import { useFormStore } from '~/stores/formStore'

  const { data: adminData } = await useFetch<{
    isAdmin: boolean
    isClinician: boolean
    isStaff: boolean
  }>('/api/users/me/is-admin', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
  if (adminData.value?.isStaff) {
    await navigateTo('/', { replace: true })
  }

  const { data: statusData } = await useFetch<{
    status: string | null
    hasClient: boolean
    userId: string | null
  }>('/api/users/me/status', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
  const userStatus = computed(() => statusData.value?.status ?? 'INCOMPLETE')

  const {
    data: profile,
    pending: profilePending,
    refresh: refreshProfile,
  } = await useFetch(() => `/api/clients/${statusData.value?.userId}/profile`, {
    key: () => `client-profile-${statusData.value?.userId ?? 'none'}`,
    watch: [() => statusData.value?.userId],
    getCachedData: () => undefined,
  })
  const { parse: parseMarkdown } = useMarkdown()
  const toast = useToast()

  const permissions = computed(
    () =>
      profile.value?.permissions ?? {
        canViewScores: false,
        canViewNotes: false,
        canViewPlan: false,
      }
  )

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
  const canViewTasks = computed(
    () => Boolean(statusData.value?.userId) && (isPreWaitlist.value || isWaitlist.value)
  )

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

  function scrollToMyPlan() {
    document.getElementById('my-plan')?.scrollIntoView({ behavior: 'smooth' })
  }

  const { form } = useFormStore()
  const submittingForm = ref<string | null>(null)

  const isApplicationComplete = computed(() => {
    const task = getTask('application')
    return task.answered === task.total && task.total > 0
  })
  const isAceComplete = computed(() => {
    const task = getTask('ace')
    return task.answered === task.total && task.total > 0
  })
  const isGadComplete = computed(() => {
    const task = getTask('gad')
    return task.answered === task.total && task.total > 0
  })
  const isPhqComplete = computed(() => {
    const task = getTask('phq')
    return task.answered === task.total && task.total > 0
  })
  const isPclComplete = computed(() => {
    const task = getTask('pcl')
    return task.answered === task.total && task.total > 0
  })

  const applicationPhoneValid = computed(() => {
    const digits = (form.value?.q5 || '').replace(/\D/g, '')
    return digits.length === 10
  })
  const showApplicationSubmit = computed(
    () => isApplicationComplete.value && !getTask('application').submitted
  )
  const showAceSubmit = computed(() => isAceComplete.value && !getTask('ace').submitted)
  const showGadSubmit = computed(() => isGadComplete.value && !getTask('gad').submitted)
  const showPhqSubmit = computed(() => isPhqComplete.value && !getTask('phq').submitted)
  const showPclSubmit = computed(() => isPclComplete.value && !getTask('pcl').submitted)

  const isPreWaitlist = computed(() => userStatus.value === 'INCOMPLETE')
  const isWaitlist = computed(() => userStatus.value === 'WAITLIST')
  const isActive = computed(() => userStatus.value === 'ACTIVE')

  const statusLabel = computed(() => {
    const labels: Record<string, string> = {
      INCOMPLETE: 'Pre-waitlist',
      WAITLIST: 'Waitlist',
      ACTIVE: 'Active',
      ARCHIVED: 'Archived',
    }
    return labels[userStatus.value] ?? userStatus.value
  })

  function getTask(key: string): any {
    if (!profile.value?.tasks)
      return { answered: 0, total: 0, submitted: false, score: null, severity: null }
    return (
      profile.value.tasks.find((t: any) => t.key === key) || {
        answered: 0,
        total: 0,
        submitted: false,
        score: null,
        severity: null,
      }
    )
  }

  const tasksFromProfile = computed(
    () =>
      (profile.value?.tasks ?? []) as {
        key: string
        name: string
        to: string
        answered: number
        total: number
        submitted: boolean
        score?: number | null
        severity?: string | null
      }[]
  )

  const visibleTasks = computed(() => {
    if (isPreWaitlist.value) {
      return tasksFromProfile.value.filter((task) => isEnrollmentTaskKey(task.key))
    }
    return tasksFromProfile.value
  })

  const tasksBadgeColor = computed(() => {
    if (isPreWaitlist.value) return 'warning' as const
    if (isWaitlist.value) return 'primary' as const
    if (isActive.value) return 'success' as const
    return 'neutral' as const
  })

  const tasksIntro = computed(() => {
    if (isPreWaitlist.value) {
      return 'Complete the application and required documents. Every form below opens in the app—the same pages as the links in email reminders from your care team.'
    }
    if (isWaitlist.value) {
      return 'Complete each clinical assessment while you wait. All forms are listed below; open any link to continue or review.'
    }
    if (isActive.value) {
      return 'Clinical assessments for your care. Open any form below—the same in-app pages as in email reminders.'
    }
    return 'Your forms and documents are listed below. Open a link anytime to continue or review, with or without an email reminder.'
  })

  function isEnrollmentTaskKey(key: string) {
    return (
      key === 'application' ||
      key === 'physicianStatement' ||
      key === 'releaseOfInformationAuthorization'
    )
  }

  function formatTaskProgress(task: {
    key: string
    answered: number
    total: number
    submitted: boolean
    score?: number | null
    severity?: string | null
  }): string {
    if (task.key === 'physicianStatement' || task.key === 'releaseOfInformationAuthorization') {
      return task.submitted ? 'Submitted' : 'Pending'
    }
    if (task.submitted) {
      if (
        task.key === 'gad' &&
        permissions.value.canViewScores &&
        task.score != null &&
        task.severity
      ) {
        return `Submitted • ${task.severity}`
      }
      return 'Submitted'
    }
    return `${task.answered}/${task.total}`
  }

  function showSubmitFor(key: string) {
    switch (key) {
      case 'application':
        return showApplicationSubmit.value
      case 'ace':
        return showAceSubmit.value
      case 'gad':
        return showGadSubmit.value
      case 'phq':
        return showPhqSubmit.value
      case 'pcl':
        return showPclSubmit.value
      default:
        return false
    }
  }

  function submitForTaskKey(key: string) {
    switch (key) {
      case 'application':
        return submitApplication()
      case 'ace':
        return submitAce()
      case 'gad':
        return submitGad()
      case 'phq':
        return submitPhq()
      case 'pcl':
        return submitPcl()
      default:
        break
    }
  }

  async function submitApplication() {
    if (!showApplicationSubmit.value) return
    if (!applicationPhoneValid.value) {
      toast.add({
        title: 'Invalid Phone Number',
        description: 'Phone Number must be exactly 10 digits before submitting.',
        color: 'error',
      })
      return
    }
    try {
      submittingForm.value = 'application'
      await $fetch('/api/forms/application/submit', { method: 'POST' })
      toast.add({
        title: 'Application Submitted',
        description: 'Your application form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      toast.add({
        title: 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
      await refreshProfile()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitAce() {
    if (!showAceSubmit.value) return
    try {
      submittingForm.value = 'ace'
      await $fetch('/api/forms/ace/submit', { method: 'POST' })
      toast.add({
        title: 'ACE Form Submitted',
        description: 'Your ACE form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      toast.add({
        title: 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
      await refreshProfile()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitGad() {
    if (!showGadSubmit.value) return
    try {
      submittingForm.value = 'gad'
      await $fetch('/api/forms/gad/submit', { method: 'POST' })
      toast.add({
        title: 'GAD-7 Form Submitted',
        description: 'Your GAD-7 form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      toast.add({
        title: 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
      await refreshProfile()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitPhq() {
    if (!showPhqSubmit.value) return
    try {
      submittingForm.value = 'phq'
      await $fetch('/api/forms/phq/submit', { method: 'POST' })
      toast.add({
        title: 'PHQ-9 Form Submitted',
        description: 'Your PHQ-9 form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      toast.add({
        title: 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
      await refreshProfile()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitPcl() {
    if (!showPclSubmit.value) return
    try {
      submittingForm.value = 'pcl'
      await $fetch('/api/forms/pcl/submit', { method: 'POST' })
      toast.add({
        title: 'PCL-5 Form Submitted',
        description: 'Your PCL-5 form has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      toast.add({
        title: 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Unable to submit. Please try again.',
        color: 'error',
      })
      await refreshProfile()
    } finally {
      submittingForm.value = null
    }
  }

  onMounted(async () => {
    try {
      await refreshProfile()
    } catch {
      // Error handling
    }
  })
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <!-- All client statuses: same form list as `/api/clients/:id/profile` (matches email reminder links) -->
    <template v-if="canViewTasks && visibleTasks.length">
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Tasks to Complete
        </h1>
        <UBadge class="mt-2" :color="tasksBadgeColor" variant="soft" size="md">
          Your status: {{ statusLabel }}
        </UBadge>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ tasksIntro }}
        </p>
      </div>
      <div
        class="mb-6 flex items-center justify-between px-1 text-sm font-medium text-black dark:text-white"
      >
        <span>Forms</span>
        <span>Progress</span>
      </div>

      <template v-for="task in visibleTasks" :key="task.key">
        <div
          v-if="task.key === 'ace' && (isWaitlist || isPreWaitlist)"
          class="mt-8 mb-2 px-1 text-sm font-medium text-black dark:text-white"
        >
          Clinical assessments
        </div>
        <div
          class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
          :class="isWaitlist && isEnrollmentTaskKey(task.key) && task.submitted ? 'opacity-60' : ''"
        >
          <NuxtLink
            :to="task.to"
            class="hover:text-primary-600 dark:hover:text-primary-400 min-w-0 flex-1 font-semibold text-black dark:text-white"
          >
            {{ task.name }}
          </NuxtLink>
          <div class="flex shrink-0 items-center gap-3">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              {{ formatTaskProgress(task) }}
            </span>
            <UButton
              v-if="showSubmitFor(task.key)"
              label="Submit"
              color="primary"
              variant="solid"
              size="sm"
              :loading="submittingForm === task.key"
              @click="submitForTaskKey(task.key)"
            />
          </div>
        </div>
      </template>
    </template>

    <template v-else-if="canViewTasks && profilePending">
      <div class="mb-8 space-y-4 py-4">
        <USkeleton class="h-10 max-w-md" />
        <USkeleton class="h-6 w-full max-w-lg" />
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
    </template>

    <UAlert
      v-else-if="canViewTasks"
      class="mb-6"
      icon="i-heroicons-exclamation-triangle-20-solid"
      color="warning"
      variant="subtle"
      title="Could not load your tasks"
      description="Try refreshing the page. If this continues, contact your care team."
    />

    <div
      v-if="permissions.canViewPlan && profile?.plan?.content"
      class="mt-10 flex flex-wrap gap-3"
    >
      <UButton
        variant="soft"
        color="primary"
        size="sm"
        icon="i-heroicons-document-plus"
        label="View my plan"
        @click="scrollToMyPlan"
      />
    </div>

    <!-- My Scores, Session Notes, Plan (visible when admin grants permission) -->
    <template v-if="permissions.canViewScores && profile?.metrics?.length">
      <section class="mt-10">
        <h2
          class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
        >
          <UIcon name="i-heroicons-chart-bar" class="h-5 w-5" />
          My Scores
        </h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="m in profile.metrics"
            :key="m.form"
            class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ m.form }}</p>
            <div class="mt-1 flex items-baseline gap-2">
              <span
                v-if="m.score != null"
                class="text-xl font-semibold text-gray-900 dark:text-white"
                >{{ m.score }}</span
              >
              <span v-if="m.severity" class="text-sm text-gray-600 dark:text-gray-400">{{
                m.severity
              }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
    <!-- Session notes: request workflow + access -->
    <section v-if="hasClient" id="session-notes-section" class="mt-10 scroll-mt-24">
      <div
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
            >
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
                  r.status === 'APPROVED'
                    ? 'success'
                    : r.status === 'REJECTED'
                      ? 'error'
                      : 'warning'
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

    <template v-if="permissions.canViewPlan && profile?.plan?.content">
      <section id="my-plan" class="mt-10">
        <h2
          class="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white"
        >
          <UIcon name="i-heroicons-document-plus" class="h-5 w-5" />
          My Treatment Plan
        </h2>
        <div
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div
            class="prose prose-sm dark:prose-invert max-w-none text-sm text-gray-900 dark:text-gray-100"
            v-html="parseMarkdown(profile.plan.content)"
          />
        </div>
      </section>
    </template>
  </main>
</template>
