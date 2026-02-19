<script setup lang="ts">
  const route = useRoute()
  const slug = computed(() => route.params.slug as string)

  const { data: result, pending, error } = await useFetch(() => `/api/forms/${slug.value}/results`)

  const form = computed(() => result.value?.form)
  const responses = computed(() => result.value?.responses || {})
  const score = computed(() => result.value?.score ?? 0)
  const totalQuestions = computed(() => result.value?.totalQuestions ?? 0)
  const completedAt = computed(() => result.value?.completedAt)

  function getAnswerText(alias: string): string {
    const answer = responses.value[alias]
    return answer || 'Not answered'
  }

  function getScoreInterpretation(aceScore: number): {
    level: string
    description: string
    color: string
  } {
    if (aceScore === 0) {
      return {
        level: 'Low Risk',
        description: 'No adverse childhood experiences reported.',
        color: 'emerald',
      }
    } else if (aceScore >= 1 && aceScore <= 3) {
      return {
        level: 'Moderate Risk',
        description: 'Some adverse childhood experiences reported. Consider support resources.',
        color: 'amber',
      }
    } else if (aceScore >= 4 && aceScore <= 6) {
      return {
        level: 'High Risk',
        description:
          'Multiple adverse childhood experiences reported. Professional support recommended.',
        color: 'orange',
      }
    } else {
      return {
        level: 'Very High Risk',
        description:
          'Many adverse childhood experiences reported. Strongly recommend professional support.',
        color: 'red',
      }
    }
  }

  const interpretation = computed(() => {
    if (slug.value === 'ace-form') {
      return getScoreInterpretation(score.value)
    }
    return null
  })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header
      class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
    >
      <div class="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between">
          <NuxtLink
            to="/tasks"
            class="text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            ← Back to Tasks
          </NuxtLink>
          <NuxtLink to="/" class="absolute left-1/2 -translate-x-1/2">
            <img src="/hopecopeheallogo.png" alt="Hope. Cope. Heal." class="h-8 w-auto" />
          </NuxtLink>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="pending" class="space-y-6">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-32 w-full" />
        <USkeleton v-for="i in 5" :key="i" class="h-20 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Error loading results"
        :description="error.message"
      />

      <template v-else-if="form">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ form.title }} - Results
          </h1>
          <p v-if="form.description" class="mt-2 text-gray-600 dark:text-gray-400">
            {{ form.description }}
          </p>
          <p v-if="completedAt" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Completed on {{ new Date(completedAt).toLocaleDateString() }} at
            {{ new Date(completedAt).toLocaleTimeString() }}
          </p>
        </div>

        <!-- Score Card -->
        <div
          class="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div class="text-center">
            <div class="mb-4">
              <span class="text-sm font-medium text-gray-500 dark:text-gray-400">Your Score</span>
            </div>
            <div class="mb-4">
              <span class="text-primary-600 dark:text-primary-400 text-6xl font-bold">{{
                score
              }}</span>
              <span class="ml-2 text-2xl text-gray-500 dark:text-gray-400"
                >/ {{ totalQuestions }}</span
              >
            </div>
            <div v-if="interpretation" class="mt-6">
              <UBadge :color="interpretation.color" size="lg" variant="subtle" class="mb-2">
                {{ interpretation.level }}
              </UBadge>
              <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {{ interpretation.description }}
              </p>
            </div>
          </div>
        </div>

        <!-- Responses Summary -->
        <div class="mb-8">
          <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Your Responses</h2>
          <!-- Instruction statement for ACE form -->
          <div
            v-if="form.slug === 'ace-form'"
            class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mb-4 rounded-lg border p-4"
          >
            <p class="text-primary-900 dark:text-primary-200 text-sm font-medium">
              While you were growing up, during your first 18 years of life:
            </p>
          </div>
          <div class="space-y-4">
            <div
              v-for="(q, index) in form.questions"
              :key="q.id"
              class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <p class="text-base font-medium text-gray-900 dark:text-white">
                    {{ index + 1 }}. {{ q.text }}
                  </p>
                  <div class="mt-2">
                    <UBadge
                      :color="
                        getAnswerText(q.alias) === 'Yes'
                          ? 'emerald'
                          : getAnswerText(q.alias) === 'No'
                            ? 'gray'
                            : 'amber'
                      "
                      variant="subtle"
                      size="sm"
                    >
                      {{ getAnswerText(q.alias) }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <NuxtLink to="/tasks">
            <UButton variant="outline" size="lg"> Back to Tasks </UButton>
          </NuxtLink>
          <NuxtLink :to="`/forms/${slug}`">
            <UButton size="lg"> Edit Responses </UButton>
          </NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>
