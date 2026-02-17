<script setup lang="ts">
import type { ApplicationForm } from '~/types/application'

const toast = useToast()
const isSaving = ref(false)
const currentStep = ref(1)

const TOTAL_STEPS = 5

const wizardSteps = [
  { label: 'User Profile', shortLabel: 'Profile' },
  { label: "Child's Information", shortLabel: 'Child' },
  { label: 'Parental/Guardian Details', shortLabel: 'Guardian' },
  { label: 'Treatment History', shortLabel: 'Treatment' },
  { label: 'Therapy Requests', shortLabel: 'Therapy' },
]

const form = reactive<ApplicationForm>({
  q1: '',
  q2: '',
  q3: '',
  q4: '',
  q5: '',
  q6: '',
  q6Text: '',
  q7: '',
  q8: '',
  q9: '',
  q10: '',
  q11: '',
  q12: '',
  q12Text: '',
  q13: '',
  q14: '',
  q15: '',
  q16: '',
  q17: '',
  q17Text: '',
  q18: [],
  q18Other: '',
  q19: '',
  q19Text: '',
  q20: '',
  q21: '',
  q22: '',
  q23: '',
  q24: '',
  q25: '',
  q26: '',
  q27: '',
  q28: '',
  q28Text: '',
  q29: '',
  q30: '',
  q31: '',
  q32: '',
  q33: '',
  q34: '',
  q35: '',
  q36: '',
  q37: '',
  q37Other: '',
  q38: '',
  q38Text: '',
  q39: '',
  q39Text: '',
  q40: '',
  q41: '',
  q42: '',
  q43: '',
  q43Text: '',
  q44: '',
  q45: '',
  q45Text: '',
  q46: '',
  q46Other: '',
  q47: '',
  q47Text: '',
  q48: '',
  q48Text: '',
  q49: '',
  q50: '',
  q50Text: '',
  q51: '',
  q51Text: '',
})

const questionDetailFieldMap: Record<number, string> = {
  6: 'q6Text',
  12: 'q12Text',
  17: 'q17Text',
  19: 'q19Text',
  28: 'q28Text',
  37: 'q37Other',
  38: 'q38Text',
  39: 'q39Text',
  43: 'q43Text',
  45: 'q45Text',
  46: 'q46Other',
  47: 'q47Text',
  48: 'q48Text',
  50: 'q50Text',
  51: 'q51Text',
}

type AppAnswerPayload = Record<string, string | null | undefined>

function applySavedAnswers(answers?: AppAnswerPayload | null) {
  if (!answers) return

  for (let index = 1; index <= 51; index += 1) {
    const key = `q${String(index).padStart(2, '0')}`
    const value = answers[key]

    if (index === 18) {
      if (typeof value === 'string' && value.length > 0) {
        try {
          const parsed = JSON.parse(value)
          form.q18 = Array.isArray(parsed) ? parsed : []
        } catch {
          form.q18 = []
        }
      }
      continue
    }

    const detailField = questionDetailFieldMap[index]
    if (detailField) {
      const formKey = `q${index}` as keyof ApplicationForm
      if (typeof value === 'string' && value.length > 0) {
        try {
          const parsed = JSON.parse(value) as { value?: string; text?: string }
          form[formKey] = (parsed.value ?? '') as ApplicationForm[keyof ApplicationForm]
          form[detailField as keyof ApplicationForm] = (parsed.text ?? '') as ApplicationForm[keyof ApplicationForm]
        } catch {
          form[formKey] = (value ?? '') as ApplicationForm[keyof ApplicationForm]
          form[detailField as keyof ApplicationForm] = '' as ApplicationForm[keyof ApplicationForm]
        }
      } else {
        form[formKey] = '' as ApplicationForm[keyof ApplicationForm]
        form[detailField as keyof ApplicationForm] = '' as ApplicationForm[keyof ApplicationForm]
      }
      continue
    }

    const formKey = `q${index}` as keyof ApplicationForm
    form[formKey] = (value ?? '') as ApplicationForm[keyof ApplicationForm]
  }
}

async function saveAndExit() {
  try {
    isSaving.value = true
    const payload: Record<string, string> = {}
    for (let index = 1; index <= 51; index += 1) {
      if (index === 18) {
        payload.q18 = JSON.stringify(form.q18 ?? [])
        continue
      }
      const detailField = questionDetailFieldMap[index]
      if (detailField) {
        const selected = form[`q${index}` as keyof ApplicationForm]
        const detail = form[detailField as keyof ApplicationForm]
        const selectedValue = typeof selected === 'string' ? selected : ''
        const detailValue = typeof detail === 'string' ? detail : ''
        if (selectedValue.length === 0 && detailValue.length === 0) {
          payload[`q${index}`] = ''
        } else {
          payload[`q${index}`] = JSON.stringify({ value: selectedValue, text: detailValue })
        }
        continue
      }
      const value = form[`q${index}` as keyof ApplicationForm]
      payload[`q${index}`] = typeof value === 'string' ? value : ''
    }
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

const genderOptions = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
  { label: 'Other', value: 'other' },
]

const yesNoOptions = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
]

const custodyOptions = [
  { label: 'Mother', value: 'mother' },
  { label: 'Father', value: 'father' },
  { label: 'Shared', value: 'shared' },
  { label: 'Guardian', value: 'guardian' },
  { label: 'Other', value: 'other' },
]

const caregiverOptions = [
  { label: 'Mother', value: 'mother' },
  { label: 'Father', value: 'father' },
  { label: 'Guardian', value: 'guardian' },
  { label: 'Other', value: 'other' },
]

const supportGroupOptions = [
  { label: 'Group A', value: 'group_a' },
  { label: 'Group B', value: 'group_b' },
  { label: 'Group C', value: 'group_c' },
  { label: 'Other', value: 'other' },
]

const referralOptions = [
  { label: 'Have a therapist', value: 'have_therapist' },
  { label: 'Need a referral', value: 'need_referral' },
]

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
          <ApplicationStepProfile
            v-if="currentStep === 1"
            :form="form"
            :gender-options="genderOptions"
          />
          <ApplicationStepChild
            v-else-if="currentStep === 2"
            :form="form"
            :gender-options="genderOptions"
            :yes-no-options="yesNoOptions"
            :custody-options="custodyOptions"
          />
          <ApplicationStepGuardian
            v-else-if="currentStep === 3"
            :form="form"
            :yes-no-options="yesNoOptions"
            :caregiver-options="caregiverOptions"
          />
          <ApplicationStepTreatment
            v-else-if="currentStep === 4"
            :form="form"
            :yes-no-options="yesNoOptions"
          />
          <ApplicationStepTherapy
            v-else-if="currentStep === 5"
            :form="form"
            :yes-no-options="yesNoOptions"
            :support-group-options="supportGroupOptions"
            :referral-options="referralOptions"
          />
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
