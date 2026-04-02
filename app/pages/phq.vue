<script setup lang="ts">
import { isDev, getPhqSeedData } from '~/utils/devSeedData'

const toast = useToast()
const isSaving = ref(false)
const isReadOnly = ref(false)
const canViewFormDetails = ref(true)

  const { data: permissions } = await useFetch<{
    canViewScores: boolean
    canViewNotes: boolean
    canViewPlan: boolean
  }>('/api/user/permissions')
  const canViewScores = computed(() => permissions.value?.canViewScores ?? false)

  const showRedactedSubmitted = computed(
    () => isReadOnly.value && !canViewFormDetails.value
  )

  const options = [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 },
  ]

  const difficultyOptions = [
    { label: 'Not difficult at all', value: 0 },
    { label: 'Somewhat difficult', value: 1 },
    { label: 'Very difficult', value: 2 },
    { label: 'Extremely difficult', value: 3 },
  ]

  const questions = [
    'Little interest or pleasure in doing things',
    'Feeling down, depressed, or hopeless',
    'Trouble falling or staying asleep, or sleeping too much',
    'Feeling tired or having little energy',
    'Poor appetite or overeating',
    'Feeling bad about yourself — or that you are a failure or have let yourself or your family down',
    'Trouble concentrating on things, such as reading the newspaper or watching television',
    'Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual',
    'Thoughts that you would be better off dead, or thoughts of hurting yourself in some way',
  ]

  const responses = ref<number[]>(Array(questions.length).fill(-1))
  const difficulty = ref<number | null>(null)
  const TOTAL_ITEMS = 10 // 9 questions + difficulty
  const completedCount = computed(
    () =>
      responses.value.filter((v) => v >= 0).length + (difficulty.value !== null ? 1 : 0)
  )
  const progressPercent = computed(() =>
    TOTAL_ITEMS ? Math.round((completedCount.value / TOTAL_ITEMS) * 100) : 0
  )
  const totalScore = computed(() =>
    responses.value.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0)
  )

  function clearForm() {
    responses.value = Array(questions.length).fill(-1)
    difficulty.value = null
  }

  async function saveForm() {
  if (isReadOnly.value) {
    await navigateTo('/taskPage')
    return
  }

  try {
    isSaving.value = true

    await $fetch('/api/phq/save', {
      method: 'POST',
      body: {
        q1: responses.value[0],
        q2: responses.value[1],
        q3: responses.value[2],
        q4: responses.value[3],
        q5: responses.value[4],
        q6: responses.value[5],
        q7: responses.value[6],
        q8: responses.value[7],
        q9: responses.value[8],
        q10: difficulty.value,
      },
    })

    toast.add({
      title: 'Saved',
      color: 'success',
    })

    await navigateTo('/taskPage')
  } catch (error: any) {
    const description =
      error?.data?.statusMessage ||
      error?.data?.message ||
      error?.statusMessage ||
      'Unable to save your responses. Please try again.'

    toast.add({
      title: 'Save failed',
      description,
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

const loadError = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{
      answers?: Record<string, unknown> | null
      submitted?: boolean
      canViewFormDetails?: boolean
    }>('/api/phq/start', {
      method: 'POST',
    })

    isReadOnly.value = Boolean(data?.submitted)
    canViewFormDetails.value = data?.canViewFormDetails !== false

    if (data?.answers) {
      responses.value = [
        data.answers.q1 ?? -1,
        data.answers.q2 ?? -1,
        data.answers.q3 ?? -1,
        data.answers.q4 ?? -1,
        data.answers.q5 ?? -1,
        data.answers.q6 ?? -1,
        data.answers.q7 ?? -1,
        data.answers.q8 ?? -1,
        data.answers.q9 ?? -1,
      ]
      difficulty.value = (data.answers.q10 ?? null) as number | null
    } else if (isDev()) {
      const seedData = getPhqSeedData()
      if (seedData) {
        responses.value = [...seedData.responses]
        difficulty.value = seedData.difficulty
      }
    }
  } catch (err: any) {
    loadError.value =
      err?.data?.statusMessage || err?.message || 'Unable to load form.'
    if (isDev()) {
      const seedData = getPhqSeedData()
      if (seedData) {
        responses.value = [...seedData.responses]
        difficulty.value = seedData.difficulty
        loadError.value = null
      }
    }
  }
})

</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="canViewScores && !isReadOnly" class="mb-6">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300"
            >{{ progressPercent }}% Complete</span
          >
          <span class="text-gray-500 dark:text-gray-400"
            >{{ completedCount }} of {{ TOTAL_ITEMS }} answered</span
          >
        </div>
        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            class="bg-primary-500 h-full rounded-full transition-all duration-300"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
      </div>

      <div class="mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
          PHQ-9 - Patient Health Questionnaire-9
        </h1>
        <p v-if="!isReadOnly" class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Over the last 2 weeks, how often have you been bothered by any of the following problems?
        </p>
        <p
          v-else-if="isReadOnly && canViewFormDetails"
          class="mt-2 text-sm font-medium text-primary-600 dark:text-primary-400"
        >
          Submitted Form (View Only).
        </p>
      </div>

      <UAlert
        v-if="loadError"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="PHQ-9: Error loading form"
        :description="loadError"
      />
      <div v-if="loadError" class="mt-4">
        <NuxtLink to="/taskPage">
          <UButton variant="outline" size="lg">Back to Tasks</UButton>
        </NuxtLink>
      </div>

      <div v-else-if="showRedactedSubmitted" class="space-y-6">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          This form has been submitted. Your answers are not shown in the app because viewing scores
          and form details is not enabled for your account.
        </p>
        <NuxtLink to="/taskPage">
          <UButton color="error" variant="soft" size="lg">Back to Tasks</UButton>
        </NuxtLink>
      </div>

      <form v-else class="space-y-8" @submit.prevent="saveForm">
        <div
          v-for="(question, index) in questions"
          :key="index"
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          :inert="isReadOnly"
        >
          <p class="font-medium text-gray-900 dark:text-white mb-3">
            {{ index + 1 }}. {{ question }}
          </p>
          <div class="flex justify-between mt-4">
            <label
              v-for="opt in options"
              :key="opt.value"
              class="flex flex-col items-center gap-1"
            >
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ opt.label }}</span>
              <input
                type="radio"
                :name="'q' + index"
                :value="opt.value"
                v-model="responses[index]"
                class="accent-primary-500 mt-1"
              />
            </label>
          </div>
        </div>

        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          :inert="isReadOnly"
        >
          <p class="font-medium text-gray-900 dark:text-white mb-3">
            If you checked off any problems, how difficult have these problems made it for you
            to do your work, take care of things at home, or get along with other people?
          </p>
          <div class="flex justify-between mt-4">
            <label
              v-for="opt in difficultyOptions"
              :key="opt.value"
              class="flex flex-col items-center gap-1"
            >
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ opt.label }}</span>
              <input
                type="radio"
                :value="opt.value"
                v-model="difficulty"
                class="accent-primary-500 mt-1"
              />
            </label>
          </div>
        </div>

        <div v-if="canViewScores" class="text-lg font-semibold text-gray-900 dark:text-white">
          Total Score: {{ totalScore }}
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            v-if="!isReadOnly"
            type="button"
            label="Clear Form"
            variant="outline"
            color="neutral"
            size="lg"
            :disabled="isSaving"
            @click="clearForm"
          />
          <UButton
            type="submit"
            :label="isReadOnly ? 'Back to Tasks' : 'Save and Exit'"
            color="error"
            variant="soft"
            size="lg"
            :loading="isSaving"
          />
        </div>
      </form>
    </main>
  </div>
</template>
