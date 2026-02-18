<script setup lang="ts">
  import { useFormStore } from '~/stores/formStore'
  import type { AppAnswerPayload } from '~/stores/formStore'
  import type { ApplicationFormState } from '~/stores/formStore'

  const toast = useToast()
  const isSaving = ref(false)
  const currentStep = ref(1)
  const { form, toPayload, applySavedAnswers } = useFormStore()

  const TOTAL_STEPS = 5

  const wizardSteps = [
    { label: 'User Profile', shortLabel: 'Profile' },
    { label: "Child's Information", shortLabel: 'Child' },
    { label: 'Parental/Guardian Details', shortLabel: 'Guardian' },
    { label: 'Treatment History', shortLabel: 'Treatment' },
    { label: 'Therapy Requests', shortLabel: 'Therapy' },
  ]

  type FormQuestionKey = keyof ApplicationFormState
  type StepState = 'upcoming' | 'current' | 'completed' | 'incomplete'
  type QuestionRequirement = FormQuestionKey | FormQuestionKey[]

  const STEP_REQUIREMENTS: QuestionRequirement[][] = [
    ['q1', 'q2', 'q3', 'q5', ['q6', 'q6Text'], 'q7', 'q8'],
    [
      'q9',
      'q10',
      'q11',
      ['q12', 'q12Text'],
      'q13',
      'q14',
      'q15',
      'q16',
      ['q17', 'q17Text'],
      ['q18', 'q18Other'],
    ],
    [
      'q19',
      'q20',
      'q21',
      'q22',
      'q23',
      'q24',
      'q25',
      'q26',
      'q27',
      'q28',
      'q29',
      'q30',
      'q31',
      'q32',
      'q33',
      'q34',
      'q35',
      'q36',
    ],
    [
      ['q37', 'q37Other'],
      'q38',
      'q39',
      'q40',
      'q41',
      'q42',
      'q43',
      'q44',
      'q45',
      ['q46', 'q46Other'],
    ],
    ['q47', 'q48', 'q49', 'q50', 'q51'],
  ]

  function hasAnswer(value: ApplicationFormState[FormQuestionKey]) {
    if (Array.isArray(value)) {
      return value.length > 0
    }

    return typeof value === 'string' && value.trim().length > 0
  }

  function isRequirementAnswered(requirement: QuestionRequirement) {
    if (Array.isArray(requirement)) {
      return requirement.some((key) => hasAnswer(form.value[key]))
    }

    return hasAnswer(form.value[requirement])
  }

  const sectionState = computed(() => {
    return STEP_REQUIREMENTS.map((requirements) => {
      const answeredCount = requirements.filter((requirement) =>
        isRequirementAnswered(requirement)
      ).length
      return {
        started: answeredCount > 0,
        completed: answeredCount === requirements.length,
      }
    })
  })

  const stepStates = computed<StepState[]>(() => {
    return wizardSteps.map((_, index) => {
      const stepNumber = index + 1
      const status = sectionState.value[index]

      if (status?.completed) {
        return 'completed'
      }

      if (stepNumber === currentStep.value) {
        return 'current'
      }

      if (!status) {
        return 'upcoming'
      }

      if (status.started) {
        return 'incomplete'
      }

      return 'upcoming'
    })
  })

  async function persistProgress(showError = true) {
    try {
      const payload = toPayload()
      await $fetch('/api/application/save', { method: 'POST', body: payload })
      return true
    } catch (error: any) {
      if (showError) {
        const description =
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Your answers could not be saved. Please try again.'

        toast.add({
          title: 'Save failed',
          description,
          color: 'error',
        })
      }

      return false
    }
  }

  async function saveAndExit() {
    try {
      isSaving.value = true
      const saved = await persistProgress(true)
      if (saved) {
        await navigateTo('/taskPage')
      }
    } finally {
      isSaving.value = false
    }
  }

  async function goNext() {
    if (currentStep.value >= TOTAL_STEPS) return

    await persistProgress(true)
    currentStep.value += 1
  }

  async function goPrev() {
    if (currentStep.value <= 1) return

    await persistProgress(true)
    currentStep.value -= 1
  }

  onBeforeRouteLeave(async () => {
    await persistProgress(false)
  })

  onMounted(async () => {
    const response = await $fetch<{ answers?: AppAnswerPayload | null }>('/api/application/start', {
      method: 'POST',
    })
    applySavedAnswers(response?.answers)
  })
</script>

<template>
  <div
    class="min-h-screen bg-gray-50 py-6 text-gray-900 sm:py-10 dark:bg-gray-950 dark:text-gray-100"
  >
    <UContainer class="max-w-3xl">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Application</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Please complete all required questions.
        </p>
      </div>

      <ApplicationStepper
        :steps="wizardSteps"
        :current-step="currentStep"
        :step-states="stepStates"
      />

      <UCard
        class="mt-6 overflow-hidden border border-gray-200 bg-white/90 shadow-xl dark:border-gray-700/60 dark:bg-gray-900/80"
        :ui="{
          body: 'p-5 sm:p-6',
        }"
      >
        <div class="mb-2 w-full border-b border-gray-200 pb-3 dark:border-gray-700/60">
          <div class="flex w-full items-center justify-between gap-3">
            <h2 class="flex-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
              {{ wizardSteps[currentStep - 1]?.label ?? 'Application' }}
            </h2>
            <span class="shrink-0 text-xs text-gray-500 dark:text-gray-400">
              Step {{ currentStep }} of {{ TOTAL_STEPS }}
            </span>
          </div>
        </div>

        <div class="min-h-[280px]">
          <FormStep :step="currentStep" />
        </div>

        <template #footer>
          <div
            class="flex flex-col gap-3 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700/60"
          >
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                label="Previous"
                color="neutral"
                variant="soft"
                size="md"
                :disabled="currentStep <= 1"
                class="min-w-[100px]"
                @click="goPrev"
              />
              <UButton
                v-if="currentStep < TOTAL_STEPS"
                label="Next"
                color="primary"
                variant="soft"
                size="md"
                class="min-w-[100px]"
                @click="goNext"
              />
            </div>
            <UButton
              label="Save and Exit"
              color="error"
              variant="soft"
              size="md"
              :loading="isSaving"
              class="min-w-[120px]"
              @click="saveAndExit"
            />
          </div>
        </template>
      </UCard>
    </UContainer>
  </div>
</template>
