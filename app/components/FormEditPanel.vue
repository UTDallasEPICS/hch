// The edit panel with 5-step stepper for application and radio inputs for clinical forms
<script setup lang="ts">
import { useFormStore } from '~/stores/formStore'
import type { AppAnswerPayload } from '~/stores/formStore'

const { applySavedAnswers, toPayload } = useFormStore()

const props = defineProps<{
  formKey: string
  clientId: string
  editableAnswers: { label: string; answer: string }[]
}>()

const emit = defineEmits<{
  save: [answers: { label: string; answer: string }[]]
  cancel: []
}>()

const wizardSteps = [
  { label: 'Profile' }, { label: 'Child' }, { label: 'Guardian' },
  { label: 'Treatment' }, { label: 'Therapy' },
]
const TOTAL_STEPS = 5
const currentStep = ref(1)
const isLoading = ref(false)
const isSaving = ref(false)

async function loadApplicationData() {
  isLoading.value = true
  try {
    const res = await $fetch<{ answers: Record<string, string> }>(
      `/api/clients/${props.clientId}/forms/application/raw`
    )
    applySavedAnswers(res.answers as AppAnswerPayload)
  } catch (err) {
    console.error('Failed to load application data:', err)
  } finally {
    isLoading.value = false
  }
}

const APP_LABELS = [
  'Email', 'First Name', 'Last Name', 'Phone Number', 'Gender',
  'Date of Birth', 'Address', "Child's First Name", "Child's Last Name",
  "Child's Date of Birth", 'Gender (Child)', "Child's Address", 'Medical Diagnosis',
  'Date of Medical Diagnosis', 'Please list all members who live in the home',
  'Does the Child Reside with Both Biological Parents?', 'Who Has Custody of the Child?',
  'Are You the Primary Contact?', "Legal Mother's First Name", "Legal Mother's Last Name",
  "Legal Mother's Address", "Legal Mother's City", "Legal Mother's State",
  "Legal Mother's Zip Code", "Legal Mother's Email", "Legal Mother's Occupation",
  'Is Legal Mother primary contact?', "Legal Father's First Name", "Legal Father's Last Name",
  "Legal Father's Address", "Legal Father's City", "Legal Father's State",
  "Legal Father's Zip Code", "Legal Father's Email", "Legal Father's Occupation",
  'Who is the primary caregiver?',
  'If child has/had siblings, did any witness a scary or traumatic event?',
  'Were siblings separated for a prolonged period from a parent and their sibling with cancer?',
  'Who was responsible for medical decisions?',
  'Who was primarily at the hospital during treatment?',
  'How long was the child in treatment?', 'Were there any ICU visits?',
  'Were there any extended hospital admissions? If so, how long?',
  'Did the child have a relapse or secondary cancer?',
  'Did the child with cancer require hospice care and/or pass away?',
  'Are you applying for the Individual Therapy Scholarship?',
  'Would you like to join a Support Group waitlist?',
  'If seeking scholarship, who are you seeking therapy scholarship for?',
  'Do you have a therapist or need a referral?',
  'Do you currently have medical insurance that provides mental health coverage?',
]

function formStateToAnswers(): { label: string; answer: string }[] {
  const payload = toPayload()
  return APP_LABELS.map((label, i) => ({
    label,
    answer: payload[`q${i + 1}`] ?? '',
  }))
}

const FREQUENCY_OPTIONS = ['Not at all', 'Several days', 'More than half the days', 'Nearly every day']
const DIFFICULTY_OPTIONS = ['Not difficult at all', 'Somewhat difficult', 'Very difficult', 'Extremely difficult']
const PCL_OPTIONS = ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely']

function getQuestionOptions(index: number): string[] | null {
  if (props.formKey === 'ace') return ['Yes', 'No']
  if (props.formKey === 'gad') return index < 7 ? FREQUENCY_OPTIONS : DIFFICULTY_OPTIONS
  if (props.formKey === 'phq') return index < 9 ? FREQUENCY_OPTIONS : DIFFICULTY_OPTIONS
  if (props.formKey === 'pcl') {
    // worstEvent is a free-text field, not a radio group
    if (localAnswers.value[index]?.label === 'Worst event') return null
    return PCL_OPTIONS
  }
  return null
}

const localAnswers = ref(props.editableAnswers.map((a) => ({ ...a })))

onMounted(async () => {
  if (props.formKey === 'application') await loadApplicationData()
})

async function handleSave() {
  isSaving.value = true
  try {
    emit('save', props.formKey === 'application' ? formStateToAnswers() : localAnswers.value)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="formKey === 'application'">
      <div v-if="isLoading" class="flex justify-center py-8">
        <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 animate-spin text-primary-500" />
      </div>
      <template v-else>
        <div class="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 pb-3 dark:border-gray-700">
          <button
            v-for="(step, i) in wizardSteps"
            :key="i"
            type="button"
            class="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
            :class="
              currentStep === i + 1
                ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            "
            @click="currentStep = i + 1"
          >
            {{ step.label }}
          </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto rounded-lg p-4">
        <FormStep :step="currentStep" />
        </div>

        <div class="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <div class="flex gap-2">
            <UButton v-if="currentStep > 1" label="Previous" color="neutral" variant="soft" size="sm" @click="currentStep--" />
            <UButton v-if="currentStep < TOTAL_STEPS" label="Next" color="primary" variant="soft" size="sm" @click="currentStep++" />
          </div>
          <div class="flex gap-2">
            <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="emit('cancel')" />
            <UButton label="Save" color="primary" size="sm" :loading="isSaving" @click="handleSave" />
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <div class="max-h-[60vh] space-y-3 overflow-y-auto">
        <div
          v-for="(q, i) in localAnswers"
          :key="i"
          class="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/80"
        >
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ q.label }}</p>
          <div v-if="getQuestionOptions(i)" class="mt-2 flex flex-wrap gap-3">
            <label
              v-for="opt in getQuestionOptions(i)!"
              :key="opt"
              class="flex cursor-pointer items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300"
            >
              <input type="radio" :name="`q-${i}`" :value="opt" v-model="q.answer" class="accent-primary-500" />
              {{ opt }}
            </label>
          </div>
          <UTextarea v-else v-model="q.answer" class="mt-1 w-full" :rows="2" autoresize />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" size="sm" @click="emit('cancel')" />
        <UButton label="Save" color="primary" size="sm" :loading="isSaving" @click="handleSave" />
      </div>
    </template>
  </div>
</template>