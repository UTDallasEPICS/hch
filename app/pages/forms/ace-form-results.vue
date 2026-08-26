<script setup lang="ts">
  definePageMeta({ middleware: 'waitlist-forms' })

  const { data: form, pending, error } = await useFetch('/api/clients/me/forms/ace')

  function getScoreInterpretation(aceScore: number): {
    level: string
    description: string
    color: 'success' | 'warning' | 'error'
  } {
    if (aceScore === 0) {
      return {
        level: 'No reported ACEs',
        description: 'No adverse childhood experiences reported.',
        color: 'success',
      }
    } else if (aceScore >= 1 && aceScore <= 3) {
      return {
        level: 'Moderate Risk',
        description: 'Some adverse childhood experiences reported. Consider support resources.',
        color: 'warning',
      }
    } else if (aceScore >= 4 && aceScore <= 6) {
      return {
        level: 'High Risk',
        description:
          'Multiple adverse childhood experiences reported. Professional support recommended.',
        color: 'warning',
      }
    } else {
      return {
        level: 'Very High Risk',
        description:
          'Many adverse childhood experiences reported. Strongly recommend professional support.',
        color: 'error',
      }
    }
  }

  const interpretation = computed(() => {
    return getScoreInterpretation(form.value?.score ?? 0)
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
          title="ACE: Error loading results"
          :description="error.message"
        />
        <div class="mt-4">
          <NuxtLink to="/taskPage">
            <UButton variant="outline" size="lg">Back to Tasks</UButton>
          </NuxtLink>
        </div>
      </template>

      <template v-else-if="form">
        <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          You have already completed this assessment.
        </div>
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            ACE Questionnaire - Results
          </h1>
          <p v-if="form.completedAt" class="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Completed on {{ new Date(form.completedAt).toLocaleDateString() }} at
            {{ new Date(form.completedAt).toLocaleTimeString() }}
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
                form.score
              }}</span>
              <span class="ml-2 text-2xl text-gray-500 dark:text-gray-400">/ 10</span>
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
          <div
            class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mb-4 rounded-lg border p-4"
          >
            <p class="text-primary-900 dark:text-primary-200 text-sm font-medium">
              While you were growing up, during your first 18 years of life:
            </p>
          </div>
          <div class="space-y-4">
            <div
              v-for="(q, index) in form.questions"
              :key="index"
              class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <p class="text-base font-medium text-gray-900 dark:text-white">
                    {{ index + 1 }}. {{ q.label }}
                  </p>
                  <div class="mt-2">
                    <UBadge
                      :color="
                        q.answer === 'Yes' ? 'success' : q.answer === 'No' ? 'neutral' : 'warning'
                      "
                      variant="subtle"
                      size="sm"
                    >
                      {{ q.answer || 'Not answered' }}
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
