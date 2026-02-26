<script setup lang="ts">
  const toast = useToast()
  const isSaving = ref(false)

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

    await navigateTo('/taskPage')
  } catch (error) {
    toast.add({
      title: 'Save failed',
      description: 'Could not save your responses.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await $fetch('/api/phq/start', {
      method: 'POST',
    })

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
      difficulty.value = data.answers.q10 ?? null
    }
  } catch (error) {
    console.error('Failed to load saved answers')
  }
})

</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <UContainer class="flex flex-col py-10 gap-6 max-w-3xl">
    <div class="mb-2">
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
    <!-- Title -->
    <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
      PHQ-9 - Patient Health Questionnaire-9
    </h1>

    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      Over the last 2 weeks, how often have you been bothered by any of the following problems?
    </p>

    <!-- Questions -->
    <div
      v-for="(question, index) in questions"
      :key="index"
      class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="font-medium text-gray-900 dark:text-white mb-3">
        {{ index + 1 }}. {{ question }}
      </p>

      <!-- Answer options -->
      <div class="flex justify-between mt-4">
        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Not at all</span>
          <input
            type="radio"
            :name="'q' + index"
            :value="0"
            v-model="responses[index]"
            class="accent-primary-500 mt-1"
          />
        </label>

        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Several days</span>
          <input
            type="radio"
            :name="'q' + index"
            :value="1"
            v-model="responses[index]"
            class="accent-primary-500 mt-1"
          />
        </label>

        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">More than half</span>
          <input
            type="radio"
            :name="'q' + index"
            :value="2"
            v-model="responses[index]"
            class="accent-primary-500 mt-1"
          />
        </label>

        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Nearly every day</span>
          <input
            type="radio"
            :name="'q' + index"
            :value="3"
            v-model="responses[index]"
            class="accent-primary-500 mt-1"
          />
        </label>
      </div>
    </div>

    <!-- Total Score -->
    <div class="text-lg font-semibold text-gray-900 dark:text-white mt-4">
      Total Score: {{ totalScore }}
    </div>

    <!-- Difficulty Question -->
    <div
      class="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <p class="font-medium text-gray-900 dark:text-white mb-3">
        If you checked off any problems, how difficult have these problems made it for you
        to do your work, take care of things at home, or get along with other people?
      </p>
      <div class="flex justify-between mt-4">
        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Not difficult at all</span>
          <input type="radio" :value="0" v-model="difficulty" class="accent-primary-500 mt-1" />
        </label>
        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Somewhat difficult</span>
          <input type="radio" :value="1" v-model="difficulty" class="accent-primary-500 mt-1" />
        </label>
        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Very difficult</span>
          <input type="radio" :value="2" v-model="difficulty" class="accent-primary-500 mt-1" />
        </label>
        <label class="flex flex-col items-center gap-1">
          <span class="text-sm text-gray-700 dark:text-gray-300">Extremely difficult</span>
          <input type="radio" :value="3" v-model="difficulty" class="accent-primary-500 mt-1" />
        </label>
      </div>
    </div>

    <!-- Save and Exit Button -->
    <div class="mt-auto pt-6 flex justify-end gap-3">
      <UButton
        label="Clear Form"
        variant="outline"
        color="neutral"
        size="lg"
        :disabled="isSaving"
        @click="clearForm"
      />
      <UButton
        label="Save and Exit"
        color="error"
        variant="soft"
        size="lg"
        :loading="isSaving"
        @click="saveForm"
      />
    </div>

  </UContainer>
  </div>
</template>
