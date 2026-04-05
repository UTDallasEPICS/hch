<script setup lang="ts">
  definePageMeta({
    middleware: 'waitlist-forms',
  })

  const toast = useToast()
  const isSaving = ref(false)

  const form = reactive({
    a01: null as string | null,
    a02: null as string | null,
    a03: null as string | null,
    a04: null as string | null,
    a05: null as string | null,
    a06: null as string | null,
    a07: null as string | null,
    a08: null as string | null,
    a09: null as string | null,
    a10: null as string | null,
  })

  const options = ['Yes', 'No']

  const questionKeys = ['a01', 'a02', 'a03', 'a04', 'a05', 'a06', 'a07', 'a08', 'a09', 'a10'] as const
  const TOTAL_QUESTIONS = 10

  const questionsText = [
    'Did a parent or other adult in the household often swear at you, insult you, put you down, or humiliate you?',
    'Did a parent or other adult in the household often push, grab, slap, or throw something at you?',
    'Did an adult or person at least 5 years older ever touch or fondle you or have you touch their body in a sexual way?',
    'Did you often feel that no one in your family loved you or thought you were important or special?',
    "Did you often feel that you didn't have enough to eat, had to wear dirty clothes, and had no one to protect you?",
    'Were your parents ever separated or divorced?',
    'Was your mother or stepmother often pushed, grabbed, slapped, or had something thrown at her?',
    'Did you live with anyone who was a problem drinker or alcoholic or who used street drugs?',
    'Was a household member depressed or mentally ill, or did a household member attempt suicide?',
    'Did a household member go to prison?',
  ]

  const completedCount = computed(
    () => Object.values(form).filter((v) => v !== null && v !== undefined).length
  )
  const progressPercent = computed(() =>
    TOTAL_QUESTIONS ? Math.round((completedCount.value / TOTAL_QUESTIONS) * 100) : 0
  )

  function applySavedAnswers(a: any) {
    if (!a) return
    form.a01 = a.a01
    form.a02 = a.a02
    form.a03 = a.a03
    form.a04 = a.a04
    form.a05 = a.a05
    form.a06 = a.a06
    form.a07 = a.a07
    form.a08 = a.a08
    form.a09 = a.a09
    form.a10 = a.a10
  }

  const loadError = ref<string | null>(null)

  onMounted(async () => {
    try {
      const res = await $fetch('/api/forms/ace/start', { method: 'POST' })
      applySavedAnswers(res?.answers)
    } catch (err: any) {
      const msg = err?.data?.statusMessage || err?.message || 'Unable to load form.'
      loadError.value = msg
    }
  })

  async function saveAndExit() {
    try {
      isSaving.value = true

      await $fetch('/api/forms/ace/save', {
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

  async function submit() {
    if (completedCount.value !== TOTAL_QUESTIONS) {
      toast.add({
        title: 'Incomplete',
        description: 'Please answer all questions before submitting.',
        color: 'error',
      })
      return
    }
    
    try {
      isSaving.value = true
      await $fetch('/api/forms/ace/save', {
        method: 'POST',
        body: { ...form, isSubmit: true },
      })
      toast.add({ title: 'Submitted successfully', color: 'success' })
      await navigateTo('/taskPage')
    } catch (error: any) {
      toast.add({ title: 'Submit failed', description: error?.message || 'Error', color: 'error' })
    } finally {
      isSaving.value = false
    }
  }
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div class="mb-6">
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
          ACE Questionnaire
        </h1>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Adverse Childhood Experiences (ACE) Questionnaire. Answer Yes or No for each question.
        </p>
      </div>

      <UAlert
        v-if="loadError"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="ACE: Error loading form"
        :description="loadError"
      />
      <div v-if="loadError" class="mt-4">
        <NuxtLink to="/taskPage">
          <UButton variant="outline" size="lg">Back to Tasks</UButton>
        </NuxtLink>
      </div>

      <form v-else class="space-y-8" @submit.prevent="submit">
        <div
          class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mb-6 rounded-lg border p-4"
        >
          <p class="text-primary-900 dark:text-primary-200 text-sm font-medium">
            While you were growing up, during your first 18 years of life:
          </p>
        </div>

        <!-- Questions - each in its own card -->
        <div
          v-for="(questionKey, index) in questionKeys"
          :key="questionKey"
          class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <p class="font-medium text-gray-900 dark:text-white mb-3">
            {{ index + 1 }}.
            {{ questionsText[index] }}
          </p>
          <div class="flex gap-4 mt-4">
            <label
              v-for="opt in options"
              :key="opt"
              class="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                :value="opt"
                v-model="form[questionKey as keyof typeof form]"
                class="accent-primary-500"
              />
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ opt }}</span>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            type="button"
            label="Save and Exit"
            color="error"
            variant="soft"
            size="lg"
            :loading="isSaving"
            @click="saveAndExit"
          />
          <UButton
            v-if="completedCount === TOTAL_QUESTIONS"
            type="submit"
            label="Submit"
            color="primary"
            size="lg"
            :loading="isSaving"
          />
        </div>
      </form>
    </main>
  </div>
</template>
