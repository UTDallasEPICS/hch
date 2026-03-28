<script setup lang="ts">
  const route = useRoute()
  const slug = computed(() => route.params.slug as string)

  const { data: result, pending, error } = await useFetch(() => `/api/forms/${slug.value}/results`)

  const form = computed(() => result.value?.form)
  const responses = computed(() => result.value?.responses || {})
  const withholdScores = computed(() => Boolean(result.value?.withholdScores))
  const score = computed(() => result.value?.score ?? null)
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
        level: 'No reported ACEs',
        description: 'No adverse childhood experiences reported.',
        color: 'emerald',
      }
    } else if (aceScore >= 1 && aceScore <= 3) {
      return {
        level: 'Intermediate risk',
        description: 'Intermediate risk for toxic stress.',
        color: 'amber',
      }
    } else {
      return {
        level: 'High risk',
        description: 'High risk for toxic stress and negative health outcomes.',
        color: 'red',
      }
    }
  }

  const interpretation = computed(() => {
    if (slug.value === 'ace-form' && score.value != null && !withholdScores.value) {
      return getScoreInterpretation(score.value)
    }
    return null
  })

  const formName = computed(() => {
    const s = slug.value
    if (s === 'ace-form') return 'ACE'
    return s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  })
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="pending" class="space-y-6">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-32 w-full" />
        <USkeleton v-for="i in 5" :key="i" class="h-20 w-full" />
      </div>

      <template v-else-if="error">
        <UAlert
          icon="i-heroicons-exclamation-triangle-20-solid"
          color="error"
          variant="subtle"
          :title="`${formName}: Error loading results`"
          :description="error.message"
        />
        <div class="mt-4">
          <NuxtLink to="/taskPage">
            <UButton variant="outline" size="lg">Back to Tasks</UButton>
          </NuxtLink>
        </div>
      </template>

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
          v-if="!withholdScores"
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
        <UAlert
          v-else
          class="mb-8"
          icon="i-heroicons-information-circle-20-solid"
          color="neutral"
          variant="subtle"
          title="Score not shown yet"
          description="Complete all assigned forms to see your score summary here. Your responses below are saved."
        />

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
          <NuxtLink to="/taskPage">
            <UButton variant="outline" size="lg"> Back to Tasks </UButton>
          </NuxtLink>
        </div>
      </template>
    </main>
  </div>
</template>
