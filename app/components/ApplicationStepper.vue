<script setup lang="ts">
  const emit = defineEmits<{
    (e: 'select-step', step: number): void
  }>()

  defineProps<{
    steps: { label: string; shortLabel?: string }[]
    currentStep: number
    stepStates?: Array<'upcoming' | 'current' | 'completed' | 'incomplete'>
  }>()
</script>

<template>
  <nav aria-label="Application progress" class="w-full">
    <ol
      class="grid w-full grid-cols-5 items-center rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4 dark:border-gray-800 dark:bg-gray-900"
      role="list"
    >
      <li v-for="(step, index) in steps" :key="index" class="relative min-w-0" role="listitem">
        <template v-if="stepStates">
          <button
            type="button"
            class="relative z-10 flex w-full cursor-pointer items-center justify-center"
            :aria-label="`Go to step ${index + 1}: ${step.label}`"
            @click="emit('select-step', index + 1)"
          >
            <div
              class="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                :class="
                  stepStates[index] === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : stepStates[index] === 'incomplete'
                      ? 'bg-amber-500 text-gray-900'
                      : stepStates[index] === 'current'
                        ? 'bg-primary-500 ring-primary-400 text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                "
                :aria-current="stepStates[index] === 'current' ? 'step' : undefined"
                :aria-label="`Step ${index + 1}: ${step.label}`"
              >
                <template v-if="stepStates[index] === 'completed'">✓</template>
                <template v-else>{{ index + 1 }}</template>
              </span>
              <span
                class="block text-[11px] leading-tight font-medium sm:hidden"
                :class="
                  stepStates[index] === 'upcoming'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-700 dark:text-gray-200'
                "
              >
                {{ step.shortLabel ?? step.label }}
              </span>
              <span
                class="hidden text-xs font-medium sm:inline"
                :class="
                  stepStates[index] === 'upcoming'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-700 dark:text-gray-200'
                "
              >
                {{ step.shortLabel ?? step.label }}
              </span>
            </div>
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="relative z-10 flex w-full cursor-pointer items-center justify-center"
            :aria-label="`Go to step ${index + 1}: ${step.label}`"
            @click="emit('select-step', index + 1)"
          >
            <div
              class="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors"
                :class="
                  index + 1 < currentStep
                    ? 'bg-emerald-600 text-white'
                    : index + 1 === currentStep
                      ? 'bg-primary-500 ring-primary-400 text-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900'
                      : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                "
                :aria-current="index + 1 === currentStep ? 'step' : undefined"
                :aria-label="`Step ${index + 1}: ${step.label}`"
              >
                <template v-if="index + 1 < currentStep">✓</template>
                <template v-else>{{ index + 1 }}</template>
              </span>
              <span
                class="block text-[11px] leading-tight font-medium sm:hidden"
                :class="
                  index + 1 <= currentStep
                    ? 'text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-500'
                "
              >
                {{ step.shortLabel ?? step.label }}
              </span>
              <span
                class="hidden text-xs font-medium sm:inline"
                :class="
                  index + 1 <= currentStep
                    ? 'text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400'
                "
              >
                {{ step.shortLabel ?? step.label }}
              </span>
            </div>
          </button>
        </template>
      </li>
    </ol>
  </nav>
</template>
