<script setup lang="ts">
  const toast = useToast()
  const isSaving = ref(false)
  const isReadOnly = ref(false)
  const worstEvent = ref('')
  const submittedScore = ref<number | null>(null)
  const submittedSeverity = ref<string | null>(null)

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
  const TOTAL_ITEMS = 21
  const completedCount = computed(() => {
    const answeredQuestions = responses.value.filter((v) => v !== -1).length
    const hasWorstEvent = worstEvent.value.trim().length > 0
    return answeredQuestions + (hasWorstEvent ? 1 : 0)
  })
  const isComplete = computed(() => completedCount.value === TOTAL_ITEMS)
  const progressPercent = computed(() =>
    TOTAL_ITEMS ? Math.round((completedCount.value / TOTAL_ITEMS) * 100) : 0
  )

  const fallbackScore = computed(() =>
    responses.value.reduce((sum, value) => sum + (value >= 0 ? value : 0), 0)
  )
  const resultScore = computed(() => submittedScore.value ?? fallbackScore.value)
  const resultSeverity = computed(() => submittedSeverity.value ?? 'Minimal')

  function getSeverityColor(level: string | null) {
    if (level === 'Minimal') return 'success'
    if (level === 'Mild') return 'warning'
    if (level === 'Moderate') return 'warning'
    if (level === 'Severe') return 'error'
    return 'neutral'
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
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Your answers could not be saved. Please try again.',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }

  async function submitForm() {
    if (isReadOnly.value) {
      await navigateTo('/taskPage')
      return
    }

    if (!isComplete.value) {
      toast.add({
        title: 'Incomplete',
        description: 'Please answer all questions before submitting.',
        color: 'error',
      })
      return
    }

    try {
      isSaving.value = true

      await $fetch('/api/pcl/save', { method: 'POST', body: buildPayload() })

      const submitResult = await $fetch<{ totalScore?: number; severity?: string }>(
        '/api/pcl/submit',
        { method: 'POST' }
      )  

      if (typeof submitResult?.totalScore === 'number') {
        submittedScore.value = submitResult.totalScore
        submittedSeverity.value = submitResult.severity ?? null
      } else {
        // fallback: re-fetch if submit doesn't return score
        const refreshed = await $fetch<{ totalScore?: number; severity?: string }>('/api/pcl/load')
        submittedScore.value = typeof refreshed?.totalScore === 'number' ? refreshed.totalScore : null
        submittedSeverity.value = typeof refreshed?.severity === 'string' ? refreshed.severity : null
      }

      isReadOnly.value = true
      
      toast.add({
        title: 'Assessment completed',
        color: 'success',
      })
      await navigateTo('/taskPage')
    } catch (error: any) {
      const isIncompleteError =
        error?.data?.statusMessage === 'Please complete all required questions before submitting'

      toast.add({
        title: isIncompleteError ? 'Incomplete' : 'Submission failed',
        description:
          error?.data?.statusMessage ||
          error?.statusMessage ||
          'Your answers could not be saved or submitted. Please try again.',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }

  onMounted(async () => {
    try {
      const data = await $fetch<{
        answers?: Record<string, any>
        submitted?: boolean
        totalScore?: number | null
        severity?: string | null
      }>('/api/pcl/load')
      isReadOnly.value = Boolean(data?.submitted)
      submittedScore.value = typeof data?.totalScore === 'number' ? data.totalScore : null
      submittedSeverity.value = typeof data?.severity === 'string' ? data.severity : null
      if (data?.answers) {
        for (let i = 1; i <= 20; i++) {
          const key = `q${String(i).padStart(2, '0')}`
          const val = data.answers[key]
          if (typeof val === 'number') {
            responses.value[i - 1] = val
          }
        }

        worstEvent.value = data.answers.worstEvent ?? ''
      }
    } catch (error: any) {
      toast.add({
        title: 'Unable to load form',
        description:
          error?.data?.statusMessage || error?.statusMessage || 'Please try again later.',
        color: 'error',
      })
      await navigateTo('/taskPage')
    }
  })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <UContainer class="max-w-3xl py-10">
      <div
        v-if="isReadOnly"
        class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800"
      >
        You have already completed this assessment.
      </div>

      <div class="mb-6" v-if="!isReadOnly">
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
          PCL-5
        </h1>
        <p v-if="!isReadOnly" class="mt-1 mb-3 text-sm text-gray-500 dark:text-gray-400">
          Instructions: Below is a list of problems that people sometimes have in response to a very
          stressful experience. Keeping your worst event in mind, please read each problem carefully
          and then select one of the numbers to the right to indicate how much you have been
          bothered by that problem in the past month.
        </p>
        <p v-else class="text-primary-600 dark:text-primary-400 mt-1 mb-3 text-sm font-medium">
          Submitted form (view only).
        </p>
      </div>

      <div
        v-if="isReadOnly"
        class="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900"
      >
        <div class="text-center">
          <div class="mb-4">
            <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Your Score</span>
          </div>
          <div class="mb-4">
            <span class="text-primary-600 dark:text-primary-400 text-6xl font-bold">
              {{ resultScore }}
            </span>
            <span class="ml-2 text-2xl text-gray-500 dark:text-gray-400">/ 80</span>
          </div>
          <div class="mt-6">
            <UBadge
              :color="getSeverityColor(resultSeverity)"
              size="lg"
              variant="subtle"
              class="mb-2"
            >
              {{ resultSeverity }}
            </UBadge>
          </div>
        </div>
      </div>

      <div
        class="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        :inert="isReadOnly"
      >
        <label class="mb-3 block font-medium text-gray-900 dark:text-white">
          Your worst event:
        </label>
        <textarea
          v-model="worstEvent"
          placeholder="Describe your worst event"
          rows="4"
          class="w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-900 placeholder-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
        ></textarea>
      </div>

      <div class="mt-6 flex flex-col gap-4" :inert="isReadOnly">
        <div
          v-for="(question, index) in questions"
          :key="index"
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <p class="mb-4 font-medium text-gray-900 dark:text-white">
            {{ index + 1 }}. {{ question }}
          </p>
          <div class="mt-4 space-y-3">
            <label
              v-for="(label, score) in [
                'Not at all',
                'A little bit',
                'Moderately',
                'Quite a bit',
                'Extremely',
              ]"
              :key="score"
              class="flex items-center gap-3"
            >
              <input
                type="radio"
                :name="'q' + index"
                :value="score"
                v-model="responses[index]"
                class="accent-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ label }}
              </span>
            </label>
          </div>
        </div>
      </div>

      <div
        v-if="!isReadOnly && !isComplete"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800"
      >
        Please answer all questions before submitting.
      </div>

      <div class="mt-12 flex justify-end gap-3">
        <UButton
          v-if="isReadOnly"
          label="Back to Tasks"
          variant="outline"
          size="lg"
          @click="saveAndExit"
        />
        <UButton
          v-else
          label="Save and Exit"
          color="error"
          variant="soft"
          size="lg"
          :loading="isSaving"
          @click="saveAndExit"
        />
        <UButton
          v-if="!isReadOnly && isComplete"
          label="Submit"
          color="primary"
          size="lg"
          :loading="isSaving"
          @click="submitForm"
        />
      </div>
    </UContainer>
  </div>
</template>
