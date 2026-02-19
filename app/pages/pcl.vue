<script setup lang="ts">
const worstEvent = ref('')

const questions = [
  'Repeated, disturbing, and unwanted memories of the stressful experience?',
  'Repeated, disturbing dreams of the stressful experience?',
  'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?',
  'Feeling very upset when something reminded you of the stressful experience?',
  'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?',
  'Avoiding memories, thoughts, or feelings related to the stressful experience?',
  'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?',
  'Trouble remembering important parts of the stressful experience?',
  'Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?',
  'Blaming yourself or someone else for the stressful experience or what happened after it?',
  'Having strong negative feelings such as fear, horror, anger, guilt, or shame?',
  'Loss of interest in activities that you used to enjoy?',
  'Feeling distant or cut off from other people?',
  'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?',
  'Irritable behavior, angry outbursts, or acting aggressively?',
  'Taking too many risks or doing things that could cause you harm?',
  'Being "superalert" or watchful or on guard?',
  'Feeling jumpy or easily startled?',
  'Having difficulty concentrating?',
  'Trouble falling or staying asleep?',
]

const responses = ref<number[]>(Array(questions.length).fill(-1))

function buildPayload() {
  const body: Record<string, number | string> = { worstEvent: worstEvent.value }
  responses.value.forEach((val, i) => {
    body[`q${i + 1}`] = val
  })
  return body
}

async function saveAndExit() {
  await $fetch('/api/pcl/save', {
    method: 'POST',
    body: buildPayload(),
  })
  navigateTo('/taskPage')
}

async function finish() {
  await $fetch('/api/pcl/save', {
    method: 'POST',
    body: buildPayload(),
  })
  await $fetch('/api/pcl/submit', { method: 'POST' })
  navigateTo('/taskPage')
}
</script>

<template>
  <UContainer class="py-10">
    <div class="mb-8">
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">PCL-5</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 mb-3">
        Instructions: Below is a list of problems that people sometimes have in response to a very
        stressful experience. Keeping your worst event in mind, please read each problem carefully
        and then select one of the numbers to the right to indicate how much you have been bothered
        by that problem in the past month.
      </p>
    </div>

    <div class="mb-6">
      <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
        Your worst event:
      </label>
      <UInput v-model="worstEvent" placeholder="Describe your worst event" class="w-full" />
    </div>

    <div class="flex flex-col gap-4 mt-6">
      <div
        v-for="(question, index) in questions"
        :key="index"
        class="bg-gray-100 dark:bg-gray-800 rounded-lg p-4"
      >
        <p class="font-medium mb-4">{{ index + 1 }}. {{ question }}</p>
        <div class="flex justify-between">
          <label
            v-for="(label, score) in ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely']"
            :key="score"
            class="flex flex-col items-center gap-1"
          >
            <input type="radio" :name="'q' + index" :value="score" v-model="responses[index]" />
            <span class="text-sm dark:text-gray-200 text-center">{{ label }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="mt-12 flex gap-4">
      <UButton label="Save and Exit" @click="saveAndExit" color="error" variant="soft" />
      <UButton label="Finish" @click="finish" color="success" variant="soft" />
    </div>
  </UContainer>
</template>