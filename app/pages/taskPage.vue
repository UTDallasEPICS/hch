<script setup lang="ts">
  const answered = ref(0)
  const total = ref(50)
  const submitted = ref(false)
  const aceAnswered = ref(0)
  const aceTotal = ref(0)
  const gadAnswered = ref(0)
  const gadTotal = ref(7)
  const gadScore = ref<number | null>(null)
  const gadSeverity = ref<string | null>(null)
  const phqAnswered = ref(0)
  const phqTotal = ref(9)
  const phqSubmitted = ref(false)
  const isSubmitting = ref(false)
  const toast = useToast()

  const isApplicationComplete = computed(() => answered.value === total.value)
  const isAceComplete = computed(() => aceTotal.value > 0 && aceAnswered.value === aceTotal.value)
  const canSubmit = computed(
    () => isApplicationComplete.value && isAceComplete.value && !submitted.value
  )
  const aceTarget = computed(() =>
    submitted.value ? '/forms/ace-form-results' : '/forms/ace-form'
  )
  const aceProgressLabel = computed(() =>
    submitted.value ? 'Submitted' : `${aceAnswered.value}/${aceTotal.value}`
  )

  async function loadProgress() {
    const [appResult, aceFormResult, aceResponsesResult, gadResult, phqResult] = await Promise.allSettled([
      $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/application/progress'),
      $fetch<{ questions: Array<{ id: string }> }>('/api/forms/ace-form'),
      $fetch<Record<string, string>>('/api/forms/ace-form/responses'),
      $fetch<{
        answered: number
        total: number
        totalScore: number | null
        severity: string | null
      }>('/api/gad/progress'),
      $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/phq/progress'),
    ])

    if (appResult.status === 'fulfilled') {
      answered.value = appResult.value.answered
      total.value = appResult.value.total
      submitted.value = Boolean(appResult.value.submitted)
    }

    if (aceFormResult.status === 'fulfilled') {
      aceTotal.value = aceFormResult.value.questions.length
    }

    if (aceResponsesResult.status === 'fulfilled') {
      aceAnswered.value = Object.values(aceResponsesResult.value).filter(
        (value) => typeof value === 'string' && value.trim().length > 0
      ).length
    }

    if (gadResult.status === 'fulfilled') {
      gadAnswered.value = gadResult.value.answered
      gadTotal.value = gadResult.value.total
      gadScore.value = gadResult.value.totalScore
      gadSeverity.value = gadResult.value.severity
    }

    if (phqResult.status === 'fulfilled') {
      phqAnswered.value = phqResult.value.answered
      phqTotal.value = phqResult.value.total
      phqSubmitted.value = Boolean(phqResult.value.submitted)
    }
  }

  async function submitForms() {
    if (!canSubmit.value) return

    try {
      isSubmitting.value = true
      await $fetch('/api/application/submit', { method: 'POST' })
      submitted.value = true
      toast.add({
        title: 'Forms submitted',
        description: 'Your application has been submitted successfully.',
        color: 'success',
      })
    } catch (error: any) {
      const description =
        error?.data?.statusMessage ||
        error?.statusMessage ||
        'Unable to submit forms. Please try again.'

      toast.add({
        title: 'Submission failed',
        description,
        color: 'error',
      })
      await loadProgress()
    } finally {
      isSubmitting.value = false
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
      gadAnswered.value = 0
      gadTotal.value = 7
      gadScore.value = null
      gadSeverity.value = null
      phqAnswered.value = 0
      phqTotal.value = 9
      phqSubmitted.value = false
    }
  })
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Tasks to complete:</h1>
    <div
      class="mt-6 flex items-center justify-between px-5 text-sm font-medium text-gray-600 dark:text-gray-300"
    >
      <span>Form</span>
      <span>Progress</span>
    </div>
    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/application"
    >
      <span>Application Form</span>
      <span>{{ submitted ? 'Submitted' : `${answered}/${total}` }}</span>
    </UButton>

    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      :to="aceTarget"
    >
      <span>ACE Form</span>
      <span>{{ aceProgressLabel }}</span>
    </UButton>

    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/gad"
    >
      <span>GAD-7 Form</span>
      <span>
        {{ gadAnswered }}/{{ gadTotal }}
        <template v-if="gadScore !== null"> • {{ gadSeverity }}</template>
      </span>
    </UButton>

    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/phq"
    >
      <span>PHQ-9 Form</span>
      <span>{{ phqSubmitted ? 'Submitted' : `${phqAnswered}/${phqTotal}` }}</span>
    </UButton>

    <div class="mt-6 flex justify-end">
      <div v-if="canSubmit" class="flex flex-col items-end gap-2">
        <p class="text-right text-sm text-red-500">
          Please verify your answers on the forms are accurate before submission.
        </p>
        <UButton
          label="Submit Forms"
          color="primary"
          variant="solid"
          :loading="isSubmitting"
          @click="submitForms"
        />
      </div>
    </div>
  </UContainer>
</template>
