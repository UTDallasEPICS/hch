<script setup lang="ts">
  import { useFormStore } from '~/stores/formStore'
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
  const toast = useToast()
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
  const showApplicationSubmit = computed(
    () => isApplicationComplete.value && !submitted.value
  )
  const showAceSubmit = computed(
    () => isAceComplete.value && !aceSubmitted.value
  )
  const showGadSubmit = computed(
    () => isGadComplete.value && !gadSubmitted.value
  )
  const showPhqSubmit = computed(
    () => isPhqComplete.value && !phqSubmitted.value
  )
  const showPclSubmit = computed(
    () => isPclComplete.value && !pclSubmitted.value
  )

  async function loadProgress() {
    const [
      appResult,
      aceProgressResult,
      gadResult,
      phqResult,
      pclResult,
    ] = await Promise.allSettled([
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
      $fetch<{ answered: number; total: number; submitted?: boolean }>(
        '/api/phq/progress'
      ),
      $fetch<{ answered: number; total: number; submitted?: boolean }>(
        '/api/pcl/progress'
      ),
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
        title: 'Invalid phone number',
        description: 'Phone number must be exactly 10 digits before submitting.',
        color: 'error',
      })
      return
    }
    try {
      submittingForm.value = 'application'
      await $fetch('/api/application/submit', { method: 'POST' })
      submitted.value = true
      toast.add({
        title: 'Application submitted',
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
        title: 'ACE Form submitted',
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
        title: 'GAD-7 Form submitted',
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
        title: 'PHQ-9 Form submitted',
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
        title: 'PCL-5 Form submitted',
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
      gadSubmitted.value = false
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
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
        Tasks to complete
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Complete each form to submit your application.
      </p>
    </div>
    <div
      class="mb-6 flex items-center justify-between px-1 text-sm font-medium text-gray-700 dark:text-gray-300"
    >
      <span>Form</span>
      <span>Progress</span>
    </div>

    <div
      v-for="form in [
        {
          name: 'Application Form',
          to: '/application',
          progress: submitted ? 'Submitted' : `${answered}/${total}`,
          showSubmit: showApplicationSubmit,
          onSubmit: submitApplication,
          key: 'application',
        },
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
            ? 'Submitted'
            : `${gadAnswered}/${gadTotal}${gadScore !== null ? ` • ${gadSeverity}` : ''}`,
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
      :key="form.key"
      class="mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <NuxtLink
        :to="form.to"
        class="min-w-0 flex-1 font-semibold text-gray-900 hover:text-primary-600 dark:text-white dark:hover:text-primary-400"
      >
        {{ form.name }}
      </NuxtLink>
      <div class="flex shrink-0 items-center gap-3">
        <span class="text-sm text-gray-600 dark:text-gray-400">
          {{ form.progress }}
        </span>
        <UButton
          v-if="form.showSubmit"
          label="Submit"
          color="primary"
          variant="solid"
          size="sm"
          :loading="submittingForm === form.key"
          @click="form.onSubmit"
        />
      </div>
    </div>
  </main>
</template>
