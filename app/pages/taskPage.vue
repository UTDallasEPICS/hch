<script setup lang="ts">
  import { useFormStore } from '~/stores/formStore'

  const { data: adminData } = await useFetch<{ isAdmin: boolean }>('/api/user/is-admin', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
  if (adminData.value?.isAdmin) {
    await navigateTo('/', { replace: true })
  }

  const { data: statusData } = await useFetch<{
    status: string | null
    hasClient: boolean
    userId: string | null
  }>('/api/user/my-status', {
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })
  const userStatus = computed(() => statusData.value?.status ?? 'INCOMPLETE')

  const { data: profile, refresh: refreshProfile } = await useFetch(
    () => `/api/clients/${statusData.value?.userId}/profile`,
    {
      key: () => `client-profile-${statusData.value?.userId ?? 'none'}`,
      watch: [() => statusData.value?.userId],
      getCachedData: () => undefined,
    }
  )
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
    () => (profile.value?.sessionNotesRequests ?? []) as {
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
        description: 'An administrator will review your request. You will receive an email when there is a decision.',
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
          'Please tap Request session notes first. After an administrator approves your request, you can view your notes here.',
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
  const answered = ref(0)
  const total = ref(50)
  const submitted = ref(false)
  const aceAnswered = ref(0)
  const aceTotal = ref(0)
  const aceSubmitted = ref(false)
  const gadAnswered = ref(0)
  const gadTotal = ref(7)
  const gadScore = ref<number | null>(null)
  const gadSeverity = ref<string | null>(null)
  const gadSubmitted = ref(false)
  const phqAnswered = ref(0)
  const phqTotal = ref(10)
  const phqSubmitted = ref(false)
  const pclAnswered = ref(0)
  const pclTotal = ref(20)
  const pclSubmitted = ref(false)
  const submittingForm = ref<string | null>(null)

  const isApplicationComplete = computed(() => answered.value === total.value)
  const isAceComplete = computed(() => aceTotal.value > 0 && aceAnswered.value === aceTotal.value)
  const isGadComplete = computed(() => gadAnswered.value === gadTotal.value)
  const isPhqComplete = computed(() => phqAnswered.value === phqTotal.value)
  const isPclComplete = computed(() => pclAnswered.value === pclTotal.value)

  const aceTarget = computed(() =>
    aceSubmitted.value ? '/forms/ace-form-results' : '/forms/ace-form'
  )

  const applicationPhoneValid = computed(() => {
    const digits = (form.value?.q5 || '').replace(/\D/g, '')
    return digits.length === 10
  })
  const showApplicationSubmit = computed(() => isApplicationComplete.value && !submitted.value)
  const showAceSubmit = computed(() => isAceComplete.value && !aceSubmitted.value)
  const showGadSubmit = computed(() => isGadComplete.value && !gadSubmitted.value)
  const showPhqSubmit = computed(() => isPhqComplete.value && !phqSubmitted.value)
  const showPclSubmit = computed(() => isPclComplete.value && !pclSubmitted.value)

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

  async function loadProgress() {
    const [appResult, aceProgressResult, gadResult, phqResult, pclResult] =
      await Promise.allSettled([
        $fetch<{ answered: number; total: number; submitted?: boolean }>(
          '/api/application/progress'
        ),
        $fetch<{ answered: number; total: number; submitted?: boolean }>(
          '/api/forms/ace-form/progress'
        ),
        $fetch<{
          answered: number
          total: number
          totalScore: number | null
          severity: string | null
          submitted?: boolean
        }>('/api/gad/progress'),
        $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/phq/progress'),
        $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/pcl/progress'),
      ])

    if (appResult.status === 'fulfilled') {
      answered.value = appResult.value.answered
      total.value = appResult.value.total
      submitted.value = Boolean(appResult.value.submitted)
    }

    if (aceProgressResult.status === 'fulfilled') {
      aceAnswered.value = aceProgressResult.value.answered
      aceTotal.value = aceProgressResult.value.total
      aceSubmitted.value = Boolean(aceProgressResult.value.submitted)
    }

    if (gadResult.status === 'fulfilled') {
      gadAnswered.value = gadResult.value.answered
      gadTotal.value = gadResult.value.total
      gadScore.value = gadResult.value.totalScore
      gadSeverity.value = gadResult.value.severity
      gadSubmitted.value = Boolean(gadResult.value.submitted)
    }

    if (phqResult.status === 'fulfilled') {
      phqAnswered.value = phqResult.value.answered
      phqTotal.value = phqResult.value.total
      phqSubmitted.value = Boolean(phqResult.value.submitted)
    }

    if (pclResult.status === 'fulfilled') {
      pclAnswered.value = pclResult.value.answered
      pclTotal.value = pclResult.value.total
      pclSubmitted.value = Boolean(pclResult.value.submitted)
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
      await $fetch('/api/application/submit', { method: 'POST' })
      submitted.value = true
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
      await loadProgress()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitAce() {
    if (!showAceSubmit.value) return
    try {
      submittingForm.value = 'ace'
      await $fetch('/api/forms/ace-form/submit', { method: 'POST' })
      aceSubmitted.value = true
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
      await loadProgress()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitGad() {
    if (!showGadSubmit.value) return
    try {
      submittingForm.value = 'gad'
      await $fetch('/api/gad/submit', { method: 'POST' })
      gadSubmitted.value = true
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
      await loadProgress()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitPhq() {
    if (!showPhqSubmit.value) return
    try {
      submittingForm.value = 'phq'
      await $fetch('/api/phq/submit', { method: 'POST' })
      phqSubmitted.value = true
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
      await loadProgress()
    } finally {
      submittingForm.value = null
    }
  }

  async function submitPcl() {
    if (!showPclSubmit.value) return
    try {
      submittingForm.value = 'pcl'
      await $fetch('/api/pcl/submit', { method: 'POST' })
      pclSubmitted.value = true
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
      await loadProgress()
    } finally {
      submittingForm.value = null
    }
  }

  function handlePhysicianStatement() {
    toast.add({
      title: 'Physician Statement Form',
      description:
        'Please contact us to receive the Physician Statement Form, or download it from your welcome email.',
      color: 'primary',
    })
  }

  function handleReleaseOfInfo() {
    toast.add({
      title: 'Release of Information Authorization Form',
      description:
        'Please contact us to receive the Release of Information Authorization Form, or download it from your welcome email.',
      color: 'primary',
    })
  }

  onMounted(async () => {
    try {
      await loadProgress()
    } catch {
      answered.value = 0
      total.value = 50
      submitted.value = false
      aceAnswered.value = 0
      aceTotal.value = 0
      aceSubmitted.value = false
      gadAnswered.value = 0
      gadTotal.value = 7
      gadScore.value = null
      gadSeverity.value = null
      phqAnswered.value = 0
      phqTotal.value = 10
      phqSubmitted.value = false
      pclAnswered.value = 0
      pclTotal.value = 20
      pclSubmitted.value = false
    }
  })
</script>

<template>
  <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
    <!-- Pre-waitlist: Application + 2 buttons -->
    <template v-if="isPreWaitlist">
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Tasks to Complete
        </h1>
        <UBadge class="mt-2" color="warning" variant="soft" size="md">
          Your status: {{ statusLabel }}
        </UBadge>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Complete the application form and provide the required documents.
        </p>
      </div>
      <div
        class="mb-6 flex items-center justify-between px-1 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <span>Form</span>
        <span>Progress</span>
      </div>

      <!-- Application Form -->
      <div
        class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <NuxtLink
          to="/application"
          class="hover:text-primary-600 dark:hover:text-primary-400 min-w-0 flex-1 font-semibold text-gray-900 dark:text-white"
        >
          Application Form
        </NuxtLink>
        <div class="flex shrink-0 items-center gap-3">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ submitted ? 'Submitted' : `${answered}/${total}` }}
          </span>
          <UButton
            v-if="showApplicationSubmit"
            label="Submit"
            color="primary"
            variant="solid"
            size="sm"
            :loading="submittingForm === 'application'"
            @click="submitApplication"
          />
        </div>
      </div>

      <!-- Physician Statement Form (button only) -->
      <div
        class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <span class="min-w-0 flex-1 font-semibold text-gray-900 dark:text-white">
          Provide Physician Statement Form
        </span>
        <UButton
          label="Provide"
          color="primary"
          variant="soft"
          size="sm"
          @click="handlePhysicianStatement"
        />
      </div>

      <!-- Release of Information Authorization Form (button only) -->
      <div
        class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <span class="min-w-0 flex-1 font-semibold text-gray-900 dark:text-white">
          Provide Release of Information Authorization Form
        </span>
        <UButton
          label="Provide"
          color="primary"
          variant="soft"
          size="sm"
          @click="handleReleaseOfInfo"
        />
      </div>
    </template>

    <!-- Waitlist: Status only, no forms -->
    <template v-else-if="isWaitlist">
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Waitlist Status
        </h1>
        <UBadge class="mt-2" color="primary" variant="soft" size="md">
          Your status: {{ statusLabel }}
        </UBadge>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">You are on the waitlist.</p>
      </div>
      <div
        class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30 rounded-xl border p-6"
      >
        <div class="flex items-center gap-3">
          <UIcon
            name="i-heroicons-queue-list"
            class="text-primary-600 dark:text-primary-400 h-10 w-10 shrink-0"
          />
          <div>
            <h2 class="font-semibold text-gray-900 dark:text-white">You are on the waitlist</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              We will contact you when a spot becomes available. No further action is needed at this
              time.
            </p>
          </div>
        </div>
      </div>
    </template>

    <!-- Active patient: ACE, GAD-7, PHQ-9, PCL-5 -->
    <template v-else-if="isActive">
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Tasks to Complete
        </h1>
        <UBadge class="mt-2" color="success" variant="soft" size="md">
          Your status: {{ statusLabel }}
        </UBadge>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Complete each clinical assessment form.
        </p>
      </div>
      <div
        class="mb-6 flex items-center justify-between px-1 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <span>Form</span>
        <span>Progress</span>
      </div>

      <div
        v-for="formItem in [
          {
            name: 'ACE Form',
            to: aceTarget,
            progress: aceSubmitted ? 'Submitted' : `${aceAnswered}/${aceTotal}`,
            showSubmit: showAceSubmit,
            onSubmit: submitAce,
            key: 'ace',
          },
          {
            name: 'GAD-7 Form',
            to: '/gad',
            progress: gadSubmitted
              ? `Submitted${permissions.canViewScores && gadScore !== null ? ` • ${gadSeverity}` : ''}`
              : `${gadAnswered}/${gadTotal}`,
            showSubmit: showGadSubmit,
            onSubmit: submitGad,
            key: 'gad',
          },
          {
            name: 'PHQ-9 Form',
            to: '/phq',
            progress: phqSubmitted ? 'Submitted' : `${phqAnswered}/${phqTotal}`,
            showSubmit: showPhqSubmit,
            onSubmit: submitPhq,
            key: 'phq',
          },
          {
            name: 'PCL-5 Form',
            to: '/pcl',
            progress: pclSubmitted ? 'Submitted' : `${pclAnswered}/${pclTotal}`,
            showSubmit: showPclSubmit,
            onSubmit: submitPcl,
            key: 'pcl',
          },
        ]"
        :key="formItem.key"
        class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <NuxtLink
          :to="formItem.to"
          class="hover:text-primary-600 dark:hover:text-primary-400 min-w-0 flex-1 font-semibold text-gray-900 dark:text-white"
        >
          {{ formItem.name }}
        </NuxtLink>
        <div class="flex shrink-0 items-center gap-3">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ formItem.progress }}
          </span>
          <UButton
            v-if="formItem.showSubmit"
            label="Submit"
            color="primary"
            variant="solid"
            size="sm"
            :loading="submittingForm === formItem.key"
            @click="formItem.onSubmit"
          />
        </div>
      </div>
    </template>

    <!-- Archived or unknown status -->
    <template v-else>
      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          Tasks
        </h1>
        <UBadge class="mt-2" color="neutral" variant="soft" size="md">
          Your status: {{ statusLabel }}
        </UBadge>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          You have no pending tasks at this time.
        </p>
      </div>
    </template>

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
              Request access to your session notes or a summary. Each request is logged and requires
              admin approval.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="primary"
              variant="solid"
              size="sm"
              icon="i-heroicons-paper-airplane"
              :disabled="sessionNotesAccess.hasPendingRequest"
              :label="sessionNotesAccess.hasPendingRequest ? 'Request pending' : 'Request session notes'"
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

        <div v-if="sessionNotesRequests.length" class="border-t border-gray-200 pt-4 dark:border-gray-700">
          <h3 class="mb-2 text-sm font-medium text-gray-900 dark:text-white">Request history</h3>
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
        v-if="sessionNotesAccess.hasAccess && sessionNotesAccess.mode === 'summary' && !sessionNotesAccess.summaryText"
        id="session-notes-summary"
        class="mt-6 scroll-mt-24"
      >
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Your summary request was approved, but the summary text is not available yet. Please check
          back later or contact the clinic.
        </p>
      </div>

      <div
        v-else-if="sessionNotesAccess.hasAccess && sessionNotesAccess.mode === 'summary' && sessionNotesAccess.summaryText"
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
        v-else-if="sessionNotesAccess.hasAccess && sessionNotesAccess.mode === 'full' && profile?.sessionNotes?.length"
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
        v-else-if="sessionNotesAccess.hasAccess && sessionNotesAccess.mode === 'full' && !profile?.sessionNotes?.length"
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
            class="text-sm text-gray-900 dark:text-gray-100 prose prose-sm dark:prose-invert max-w-none"
            v-html="parseMarkdown(profile.plan.content)"
          />
        </div>
      </section>
    </template>
  </main>
</template>
