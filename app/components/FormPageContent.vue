<script setup lang="ts">
const props = defineProps<{ slug: string }>()
const slugRef = computed(() => props.slug)
const {
    form,
    formPending,
    formError,
    formStatus,
    slug,
    responses,
    completedCount,
    totalCount,
    progressPercent,
    setResponse,
  submitting,
  submitError,
  showIncompleteBanner,
  unansweredCount,
  dismissIncompleteBanner,
  submit,
} = await useFormBySlug(slugRef)
</script>

<style scoped>
.float-enter-active,
.float-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.float-enter-from,
.float-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
</style>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
    <header
      class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"
    >
      <div class="relative mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
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
      <div
        v-if="form"
        class="border-t border-gray-100 bg-gray-50/80 px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900/80"
      >
        <div class="mx-auto max-w-3xl">
          <div class="flex items-center justify-between text-sm">
            <span class="font-medium text-gray-700 dark:text-gray-300"
              >{{ progressPercent }}% Complete</span
            >
            <span class="text-gray-500 dark:text-gray-400"
              >{{ completedCount }} of {{ totalCount }} answered</span
            >
          </div>
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              class="bg-primary-500 h-full rounded-full transition-all duration-300"
              :style="{ width: `${progressPercent}%` }"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div v-if="formPending" class="space-y-6">
        <USkeleton class="h-8 w-2/3" />
        <USkeleton class="h-4 w-full" />
        <USkeleton v-for="i in 5" :key="i" class="h-20 w-full" />
      </div>

      <UAlert
        v-else-if="formError || !slug"
        icon="i-heroicons-exclamation-triangle-20-solid"
        color="error"
        variant="subtle"
        title="Form not found"
        :description="
          formError?.message || 'Invalid form URL. Please check the link and try again.'
        "
      >
        <template #actions>
          <UButton to="/tasks" variant="outline" size="sm"> Go to Tasks </UButton>
        </template>
      </UAlert>

      <template v-else-if="form">
        <div class="mb-8">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ form.title }}
          </h1>
          <p v-if="form.description" class="mt-2 text-gray-600 dark:text-gray-400">
            {{ form.description }}
          </p>
          <UAlert
            v-if="formStatus?.isCompleted"
            color="info"
            variant="subtle"
            title="Editing Completed Form"
            description="You are editing a previously completed form. Your changes will update your results."
            class="mt-4"
          />
        </div>

        <form class="space-y-8" @submit.prevent="submit">
          <div
            v-if="form.slug === 'ace-form'"
            class="border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20 mb-6 rounded-lg border p-4"
          >
            <p class="text-primary-900 dark:text-primary-200 text-sm font-medium">
              While you were growing up, during your first 18 years of life:
            </p>
          </div>

          <div
            v-for="(q, index) in form.questions"
            :key="q.id"
            class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900"
          >
            <fieldset>
              <legend class="text-base font-medium text-gray-900 dark:text-white">
                {{ Number(index) + 1 }}. {{ q.text }}
              </legend>
              <div v-if="q.type === 'radio'" class="mt-4 flex flex-wrap gap-3">
                <label
                  v-for="opt in ['Yes', 'No']"
                  :key="opt"
                  class="focus-within:ring-primary-500 relative flex cursor-pointer items-center rounded-lg border px-4 py-3 transition focus-within:ring-2"
                  :class="
                    responses[q.alias] === opt
                      ? 'border-primary-500 bg-primary-50 dark:border-primary-600 dark:bg-primary-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  "
                >
                  <input
                    type="radio"
                    :name="q.alias"
                    :value="opt"
                    :checked="responses[q.alias] === opt"
                    class="sr-only"
                    @change="setResponse(q.alias, opt)"
                  />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ opt }}</span>
                </label>
              </div>
              <div v-else class="mt-4">
                <input
                  :value="responses[q.alias]"
                  type="text"
                  :name="q.alias"
                  class="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  placeholder="Your answer"
                  @input="setResponse(q.alias, ($event.target as HTMLInputElement).value)"
                />
              </div>
            </fieldset>
          </div>

          <UAlert
            v-if="submitError"
            color="error"
            variant="subtle"
            :title="submitError"
            class="mb-4"
          />

          <div class="flex justify-end gap-3">
            <UButton
              type="submit"
              size="lg"
              :loading="submitting"
              :disabled="submitting"
              @click.prevent="submit"
            >
              Submit
            </UButton>
          </div>
        </form>
      </template>
    </main>

    <!-- Floating box: incomplete form info after submit attempt -->
    <Transition name="float">
      <div
        v-if="form && showIncompleteBanner && unansweredCount > 0"
        class="fixed bottom-6 right-6 z-50 flex max-w-sm items-start gap-3 rounded-xl border border-amber-200 bg-white p-4 shadow-lg dark:border-amber-800 dark:bg-gray-900"
      >
        <UIcon
          name="i-heroicons-exclamation-circle-20-solid"
          class="mt-0.5 h-5 w-5 shrink-0 text-amber-500"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-gray-900 dark:text-white">Form incomplete</p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            You have
            <span class="font-semibold text-amber-600 dark:text-amber-400">{{ unansweredCount }}</span>
            {{ unansweredCount === 1 ? 'question' : 'questions' }} left ({{ totalCount }} total).
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          class="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          @click="dismissIncompleteBanner"
        >
          <UIcon name="i-heroicons-x-mark-20-solid" class="h-4 w-4" />
        </button>
      </div>
    </Transition>
  </div>
</template>
