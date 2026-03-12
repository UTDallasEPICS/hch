<script setup lang="ts">
import { isDev, getGadSeedData } from '~/utils/devSeedData'

const toast = useToast()
const isSaving = ref(false)

  const { data: permissions } = await useFetch<{
    canViewScores: boolean
    canViewNotes: boolean
    canViewPlan: boolean
  }>('/api/user/permissions')
  const canViewScores = computed(() => permissions.value?.canViewScores ?? false)

  const form = reactive({
    g1: null as number | null,
    g2: null as number | null,
    g3: null as number | null,
    g4: null as number | null,
    g5: null as number | null,
    g6: null as number | null,
    g7: null as number | null,
    g8: null as number | null,
  })

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

  const questionKeys = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] as const
  const TOTAL_QUESTIONS = 8 // 7 main + 1 difficulty

  const completedCount = computed(
    () => [form.g1, form.g2, form.g3, form.g4, form.g5, form.g6, form.g7, form.g8].filter(
      (v) => v !== null && v !== undefined
    ).length
  )
  const progressPercent = computed(() =>
    TOTAL_QUESTIONS ? Math.round((completedCount.value / TOTAL_QUESTIONS) * 100) : 0
  )

  const totalScore = computed(() => {
    return (
      (form.g1 ?? 0) +
      (form.g2 ?? 0) +
      (form.g3 ?? 0) +
      (form.g4 ?? 0) +
      (form.g5 ?? 0) +
      (form.g6 ?? 0) +
      (form.g7 ?? 0)
    )
  })

  const severity = computed(() => {
    const s = totalScore.value
    if (s <= 4) return 'Minimal'
    if (s <= 9) return 'Mild'
    if (s <= 14) return 'Moderate'
    return 'Severe'
  })

  function applySavedAnswers(a: any) {
    if (!a) return
    form.g1 = a.g01
    form.g2 = a.g02
    form.g3 = a.g03
    form.g4 = a.g04
    form.g5 = a.g05
    form.g6 = a.g06
    form.g7 = a.g07
    form.g8 = a.g08
  }

  const loadError = ref<string | null>(null)

  onMounted(async () => {
    try {
      const res = await $fetch('/api/gad/start', { method: 'POST' })
      applySavedAnswers(res?.answers)
      if (!res?.answers && isDev()) {
        const seedData = getGadSeedData()
        if (seedData) {
          form.g1 = seedData.g1
          form.g2 = seedData.g2
          form.g3 = seedData.g3
          form.g4 = seedData.g4
          form.g5 = seedData.g5
          form.g6 = seedData.g6
          form.g7 = seedData.g7
          form.g8 = seedData.g8
        }
      }
    } catch (err: any) {
      const msg = err?.data?.statusMessage || err?.message || 'Unable to load form.'
      loadError.value = msg
      if (isDev()) {
        const seedData = getGadSeedData()
        if (seedData) {
          form.g1 = seedData.g1
          form.g2 = seedData.g2
          form.g3 = seedData.g3
          form.g4 = seedData.g4
          form.g5 = seedData.g5
          form.g6 = seedData.g6
          form.g7 = seedData.g7
          form.g8 = seedData.g8
          loadError.value = null
        }
      }
    }
  })

  function clearForm() {
    form.g1 = null
    form.g2 = null
    form.g3 = null
    form.g4 = null
    form.g5 = null
    form.g6 = null
    form.g7 = null
    form.g8 = null
  }

  async function saveAndExit() {
    try {
      isSaving.value = true

      await $fetch('/api/gad/save', {
        method: 'POST',
        body: form,
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
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="canViewScores" class="mb-6">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300"
            >{{ progressPercent }}% Complete</span
          >
          <span class="text-gray-500 dark:text-gray-400"
            >{{ completedCount }} of {{ TOTAL_QUESTIONS }} answered</span
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
          GAD-7 Anxiety Assessment
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Over the last <span class="font-medium">two weeks</span>, how often have you been bothered
          by the following problems?
        </p>
      </div>

      <UAlert
        v-if="loadError"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="GAD-7: Error loading form"
        :description="loadError"
      />
      <div v-if="loadError" class="mt-4">
        <NuxtLink to="/taskPage">
          <UButton variant="outline" size="lg">Back to Tasks</UButton>
        </NuxtLink>
      </div>

      <form v-else class="space-y-8" @submit.prevent="saveAndExit">
        <!-- Questions - each in its own card -->
        <div
          v-for="(questionKey, index) in questionKeys"
          :key="questionKey"
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <p class="font-medium text-gray-900 dark:text-white mb-3">
            {{ index + 1 }}.
            {{
              [
                'Feeling nervous, anxious, or on edge',
                'Not being able to stop or control worrying',
                'Worrying too much about different things',
                'Trouble relaxing',
                'Being so restless that it is hard to sit still',
                'Becoming easily annoyed or irritable',
                'Feeling afraid, as if something awful might happen',
              ][index]
            }}
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
                :value="opt.value"
                v-model="form[questionKey as keyof typeof form]"
                class="accent-primary-500 mt-1"
              />
            </label>
          </div>
        </div>

        <!-- Difficulty Question -->
        <div
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <p class="font-medium text-gray-900 dark:text-white mb-3">
            If you checked any problems, how difficult have they made it for you?
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
                v-model="form.g8"
                class="accent-primary-500 mt-1"
              />
            </label>
          </div>
        </div>

        <!-- Total Score or Permission Message -->
        <div v-if="canViewScores" class="text-lg font-semibold text-gray-900 dark:text-white">
          Total Score: {{ totalScore }}
          <span class="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400"
            >({{ severity }})</span
          >
        </div>
        <UAlert
          v-else
          icon="i-heroicons-exclamation-triangle-20-solid"
          color="error"
          variant="subtle"
          title="GAD-7: You do not have permission to view scores"
          description="Your administrator has not enabled this feature for your account. Please contact your clinician for any further inquiries."
        />

        <div class="flex justify-end gap-3">
          <UButton
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
            label="Save and Exit"
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
