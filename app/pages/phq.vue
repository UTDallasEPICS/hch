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
  const totalScore = computed(() =>
    responses.value.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0)
  )
</script>

<template>
  <UContainer class="flex flex-col py-10 gap-6">
    <!-- Title -->
    <h1 class="text-2xl font-semibold text-center text-gray-900 dark:text-white">
      PHQ-9 - Patient Health Questionnaire-9
    </h1>

    <!-- Questions -->
    <div
      v-for="(question, index) in questions"
      :key="index"
      class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 shadow-sm"
    >
      <p class="font-medium mb-3">
        {{ index + 1 }}. {{ question }}
      </p>

      <!-- Answer options -->
      <div class="flex justify-between">
        <label class="flex flex-col items-center">
          <span class="text-sm">Not at all</span>
          <input type="radio" :name="'q' + index" value="0" v-model="responses[index]" />
        </label>

        <label class="flex flex-col items-center">
          <span class="text-sm">Several days</span>
          <input type="radio" :name="'q' + index" value="1" v-model="responses[index]" />
        </label>

        <label class="flex flex-col items-center">
          <span class="text-sm">More than half</span>
          <input type="radio" :name="'q' + index" value="2" v-model="responses[index]" />
        </label>

        <label class="flex flex-col items-center">
          <span class="text-sm">Nearly every day</span>
          <input type="radio" :name="'q' + index" value="3" v-model="responses[index]" />
        </label>
      </div>
    </div>

    <!-- Total Score -->
    <div class="text-lg font-medium mt-4">
      Total Score: {{ totalScore }}
    </div>

    <!-- Difficulty Question -->
    <div class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 shadow-sm mt-4">
      <p class="font-medium mb-3">
        If you checked off any problems, how difficult have these problems made it for you
        to do your work, take care of things at home, or get along with other people?
      </p>
      <div class="flex justify-between">
        <label class="flex flex-col items-center">
          <span class="text-sm">Not difficult at all</span>
          <input type="radio" value="0" v-model="difficulty" />
        </label>
        <label class="flex flex-col items-center">
          <span class="text-sm">Somewhat difficult</span>
          <input type="radio" value="1" v-model="difficulty" />
        </label>
        <label class="flex flex-col items-center">
          <span class="text-sm">Very difficult</span>
          <input type="radio" value="2" v-model="difficulty" />
        </label>
        <label class="flex flex-col items-center">
          <span class="text-sm">Extremely difficult</span>
          <input type="radio" value="3" v-model="difficulty" />
        </label>
      </div>
    </div>

    <!-- Save and ExitButton -->
    <div class="mt-auto pt-6">
      <UButton label="Save and Exit" to="/taskPage" color="error" variant="soft" />
    </div>

    <!-- Finish Button -->
    <div class="mt-6 flex justify-between gap-3">
      <UButton label="Finish" to="/taskPage" color="success" variant="soft" />
    </div>
  </UContainer>
</template>
