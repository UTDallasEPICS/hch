<script setup lang="ts">
const toast = useToast()
const isSaving = ref(false)
const isReadOnly = ref(false)
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
  'Trouble experiencing positive feelings (sfor example, being unable to feel happiness or have loving feelings for people close to you)?',
  'Irritable behavior, angry outbursts, or acting aggressively?',
  'Taking too many risks or doing things that could cause you harm?',
  'Being "superalert" or watchful or on guard?',
  'Feeling jumpy or easily startled?',
  'Having difficulty concentrating?',
  'Trouble falling or staying asleep?',
]

const responses = ref<number[]>(Array(questions.length).fill(-1))
const TOTAL_QUESTIONS = 20
const completedCount = computed(
  () => responses.value.filter((v) => v !== -1).length
)
const progressPercent = computed(() =>
  TOTAL_QUESTIONS ? Math.round((completedCount.value / TOTAL_QUESTIONS) * 100) : 0
)

function clearForm() {
  responses.value = Array(questions.length).fill(-1)
  worstEvent.value = ''
}

function buildPayload() {
  const body: Record<string, number | string | null> = { worstEvent: worstEvent.value }
  responses.value.forEach((val, i) => {
    body[`q${i + 1}`] = val === -1 ? null : val
  })
  return body
}

async function saveAndExit() {
  if (isReadOnly.value) {
    await navigateTo('/taskPage')
    return
  }

  try {
    isSaving.value = true
    await $fetch('/api/pcl/save', { method: 'POST', body: buildPayload() })
    await navigateTo('/taskPage')
  } catch (error: any) {
    toast.add({
      title: 'Save failed',
      description: error?.data?.statusMessage || error?.statusMessage || 'Your answers could not be saved. Please try again.',
      color: 'error',
    })
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  try {
    const data = await $fetch<{ answers?: Record<string, any>; submitted?: boolean }>('/api/pcl/load')
    isReadOnly.value = Boolean(data?.submitted)
    if (data?.answers) {
      for (let i = 1; i <= 20; i++) {
        const key = `q${String(i).padStart(2, '0')}`
        const val = data.answers[key]
        if (typeof val === 'number') {
          responses.value[i - 1] = val
        }
      }
    }
  } catch (error: any) {
    toast.add({
      title: 'Unable to load form',
      description: error?.data?.statusMessage || error?.statusMessage || 'Please try again later.',
      color: 'error',
    })
    await navigateTo('/taskPage')
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
  <UContainer class="max-w-3xl py-10">
    <div class="mb-6" v-if="!isReadOnly">
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
        PCL-5
      </h1>
      <p v-if="!isReadOnly" class="mt-1 text-sm text-gray-500 dark:text-gray-400 mb-3">
        Instructions: Below is a list of problems that people sometimes have in response to a very
        stressful experience. Keeping your worst event in mind, please read each problem carefully
        and then select one of the numbers to the right to indicate how much you have been bothered
        by that problem in the past month.
      </p>
      <p v-else class="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400 mb-3">
        Submitted Form (View Only).
      </p>
    </div>

    <div class="mb-6" :inert="isReadOnly">
      <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
        Your worst event:
      </label>
      <UInput v-model="worstEvent" placeholder="Describe Your Worst Event" class="w-full" />
    </div>

    <div class="flex flex-col gap-4 mt-6" :inert="isReadOnly">
      <div
        v-for="(question, index) in questions"
        :key="index"
        class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <p class="font-medium text-gray-900 dark:text-white mb-4">{{ index + 1 }}. {{ question }}</p>
        <div class="flex justify-between mt-4">
          <label
            v-for="(label, score) in ['Not at all', 'A little bit', 'Moderately', 'Quite a bit', 'Extremely']"
            :key="score"
            class="flex flex-col items-center gap-1"
          >
            <input
              type="radio"
              :name="'q' + index"
              :value="score"
              v-model="responses[index]"
              class="accent-primary-500 mt-1"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300 text-center">{{ label }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="mt-12 flex justify-end gap-3">
      <UButton
        v-if="!isReadOnly"
        label="Clear Form"
        variant="outline"
        color="neutral"
        size="lg"
        :disabled="isSaving"
        @click="clearForm"
      />
      <UButton
        :label="isReadOnly ? 'Back to Tasks' : 'Save and Exit'"
        color="error"
        variant="soft"
        size="lg"
        :loading="isSaving"
        @click="saveAndExit"
      />
    </div>
  </UContainer>
  </div>
</template>