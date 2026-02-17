<script setup lang="ts">
import { useFormStore } from '~/stores/formStore'
import type { AppAnswerPayload } from '~/stores/formStore'

const toast = useToast()
const isSaving = ref(false)
const currentStep = ref(1)
const { toPayload, applySavedAnswers } = useFormStore()

const TOTAL_STEPS = 5

const wizardSteps = [
  { label: 'User Profile', shortLabel: 'Profile' },
  { label: "Child's Information", shortLabel: 'Child' },
  { label: 'Parental/Guardian Details', shortLabel: 'Guardian' },
  { label: 'Treatment History', shortLabel: 'Treatment' },
  { label: 'Therapy Requests', shortLabel: 'Therapy' },
]

async function saveAndExit() {
  try {
    isSaving.value = true
    const payload = toPayload()
    await $fetch('/api/application/save', { method: 'POST', body: payload })
    await navigateTo('/taskPage')
  } catch {
    toast.add({
      title: 'Save failed',
      description: 'Your answers could not be saved. Please try again.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

function goNext() {
  if (currentStep.value < TOTAL_STEPS) currentStep.value += 1
}

function goPrev() {
  if (currentStep.value > 1) currentStep.value -= 1
}

onMounted(async () => {
  const response = await $fetch<{ answers?: AppAnswerPayload | null }>('/api/application/start', {
    method: 'POST',
  })
  applySavedAnswers(response?.answers)
})
</script>

<template>
  <div class="min-h-screen bg-gray-950 py-6 sm:py-10">
    <UContainer class="max-w-3xl">
      <div class="mb-6 sm:mb-8">
        <h1 class="text-2xl font-semibold text-gray-100">Application</h1>
        <p class="mt-1 text-sm text-gray-400">
          Please complete all required questions.
        </p>
      </div>

      <ApplicationStepper :steps="wizardSteps" :current-step="currentStep" />

      <UCard
        class="mt-6 overflow-hidden border border-gray-700/60 bg-gray-900/80 shadow-xl"
        :ui="{
          body: { base: '', padding: 'p-5 sm:p-6' },
          ring: '',
          divide: 'divide-gray-700/60',
        }"
      >
        <div class="mb-2 flex items-center justify-between border-b border-gray-700/60 pb-3">
          <h2 class="text-lg font-semibold text-gray-100">
            {{ wizardSteps[currentStep - 1].label }}
          </h2>
          <span class="text-xs text-gray-500">
            Step {{ currentStep }} of {{ TOTAL_STEPS }}
          </span>
        </div>

        <div class="min-h-[280px]">
          <FormStep :step="currentStep" />
        </div>

        <template #footer>
          <div
            class="flex flex-col gap-3 border-t border-gray-700/60 pt-4 sm:flex-row sm:items-center sm:justify-between"
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
