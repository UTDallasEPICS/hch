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

  const responses = ref<number[]>(Array(9).fill(-1))
  const difficulty = ref<number | null>(null)
  const totalScore = computed(() =>
    responses.value.reduce((sum, val) => sum + (val >= 0 ? val : 0), 0)
  )
</script>

<template>
  <UContainer class="flex min-h-[70vh] flex-col py-10">
    <!--Form Title-->
    <h1 class="mb-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
      PHQ-9 - Patient Health Questionnaire-9
    </h1>

    <!-- Headers -->
    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b">
          <th class="p-3 text-left">
            Over the last 2 weeks, how often have you been bothered by any of the following
            problems?
          </th>
          <th class="p-3 text-center">Not at all</th>
          <th class="p-3 text-center">Several days</th>
          <th class="p-3 text-center">More than half the days</th>
          <th class="p-3 text-center">Nearly every day</th>
        </tr>
      </thead>

      <tbody>
        <tr v-for="(question, index) in questions" :key="index" class="border-b">
          <!-- Question -->
          <td class="p-3 align-top">{{ index + 1 }}. {{ question }}</td>

          <!-- Score Columns -->
          <td v-for="score in [0, 1, 2, 3]" :key="score" class="p-3 text-center">
            <!-- don't want to show the number above the radio button -->
            <!---
            <div class="flex flex-col items-center">
              <span class="text-sm mb-1">
                {{ score }}
              </span>
            -->
            <input type="radio" :name="'q' + index" :value="score" v-model="responses[index]" />
            <!--</div>-->
          </td>
        </tr>
      </tbody>
    </table>

    <div class="mt-6 text-lg font-medium">Total Score: {{ totalScore }}</div>

    <div class="mt-4 pt-6">
      <p class="mb-4 font-medium">
        If you checked off any problems, how difficult have these problems made it for you to do
        your work, take care of things at home, or get along with other people?
      </p>

      <div class="grid grid-cols-4 gap-6 text-center">
        <label class="flex flex-col items-center">
          <span class="mb-2">Not difficult at all</span>
          <input type="radio" value="0" v-model="difficulty" />
        </label>

        <label class="flex flex-col items-center">
          <span class="mb-2">Somewhat difficult</span>
          <input type="radio" value="1" v-model="difficulty" />
        </label>

        <label class="flex flex-col items-center">
          <span class="mb-2">Very difficult</span>
          <input type="radio" value="2" v-model="difficulty" />
        </label>

        <label class="flex flex-col items-center">
          <span class="mb-2">Extremely difficult</span>
          <input type="radio" value="3" v-model="difficulty" />
        </label>
      </div>
    </div>

    <div class="mt-auto pt-6">
      <UButton label="Save and Exit" to="/taskPage" color="error" variant="soft" />
    </div>
  </UContainer>
</template>
