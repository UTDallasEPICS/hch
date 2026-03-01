<script setup lang="ts">
  const answered = ref(0)
  const total = ref(50)
  const submitted = ref(false)
  const aceAnswered = ref(0)
  const aceTotal = ref(0)
  const aceSubmitted = ref(false)
  const gadAnswered = ref(0)
  const gadTotal = ref(8)
  const gadScore = ref<number | null>(null)
  const gadSeverity = ref<string | null>(null)
  const gadSubmitted = ref(false)
  const phqAnswered = ref(0)
  const phqTotal = ref(9)
  const phqSubmitted = ref(false)
  const pclAnswered = ref(0)
  const pclTotal = ref(21)
  const pclSubmitted = ref(false)

  const aceTarget = computed(() =>
    aceSubmitted.value ? '/forms/ace-form-results' : '/forms/ace-form'
  )
  const aceProgressLabel = computed(() =>
    aceSubmitted.value ? 'Submitted' : `${aceAnswered.value}/${aceTotal.value}`
  )

  async function loadProgress() {
    const [appResult, aceFormResult, aceResponsesResult, gadResult, phqResult, pclResult] =
      await Promise.allSettled([
        $fetch<{ answered: number; total: number; submitted?: boolean }>(
          '/api/application/progress'
        ),
        $fetch<{ questions: Array<{ id: string }> }>('/api/forms/ace-form'),
        $fetch<Record<string, string>>('/api/forms/ace-form/responses'),
        $fetch<{
          answered: number
          total: number
          totalScore: number | null
          severity: string | null
          status?: string | null
        }>('/api/gad/progress'),
        $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/phq/progress'),
        $fetch<{ answered: number; total: number; submitted?: boolean }>('/api/pcl/progress'),
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
      aceSubmitted.value = aceTotal.value > 0 && aceAnswered.value === aceTotal.value
    }

    if (gadResult.status === 'fulfilled') {
      gadAnswered.value = gadResult.value.answered
      gadTotal.value = gadResult.value.total
      gadScore.value = gadResult.value.totalScore
      gadSeverity.value = gadResult.value.severity
      gadSubmitted.value =
        gadResult.value.status === 'SUBMITTED' || gadResult.value.status === 'COMPLETE'
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
      gadTotal.value = 8
      gadScore.value = null
      gadSeverity.value = null
      gadSubmitted.value = false
      phqAnswered.value = 0
      phqTotal.value = 9
      phqSubmitted.value = false
      pclAnswered.value = 0
      pclTotal.value = 21
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
        Complete all forms to enter the waitlist.
      </p>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Once submitted, you can review your responses and results at any time.
      </p>
    </div>
    <div
      class="mb-6 flex items-center justify-between px-1 text-sm font-medium text-gray-700 dark:text-gray-300"
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
        <template v-if="gadSubmitted"> Submitted </template>
        <template v-else> {{ gadAnswered }}/{{ gadTotal }} </template>
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

    <UButton
      class="mt-3 w-full justify-between rounded-xl px-5 py-4 text-sm font-semibold"
      color="primary"
      variant="soft"
      to="/pcl"
    >
      <span>PCL-5 Form</span>
      <span>{{ pclSubmitted ? 'Submitted' : `${pclAnswered}/${pclTotal}` }}</span>
    </UButton>
  </main>
</template>
