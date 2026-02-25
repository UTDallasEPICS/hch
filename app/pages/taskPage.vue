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
    const [progress, aceForm, aceResponses, gadProgress] = await Promise.all([
      $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/application/progress'),
      $fetch<{ questions: Array<{ id: string }> }>('/api/forms/ace-form'),
      $fetch<Record<string, string>>('/api/forms/ace-form/responses'),
      $fetch<{
        answered: number
        total: number
        totalScore: number | null
        severity: string | null
      }>('/api/gad/progress'),
    ])

    answered.value = progress.answered
    total.value = progress.total
    submitted.value = Boolean(progress.submitted)

    aceTotal.value = aceForm.questions.length
    aceAnswered.value = Object.values(aceResponses).filter(
      (value) => typeof value === 'string' && value.trim().length > 0
    ).length

    gadAnswered.value = gadProgress.answered
    gadTotal.value = gadProgress.total
    gadScore.value = gadProgress.totalScore
    gadSeverity.value = gadProgress.severity
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
