<script setup lang="ts">
defineProps<{
  steps: { label: string; shortLabel?: string }[]
  currentStep: number
}>()
</script>

<template>
  <nav aria-label="Application progress" class="w-full">
    <ol
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-700/60 bg-gray-800/50 p-3 sm:p-4"
      role="list"
    >
      <li
        v-for="(step, index) in steps"
        :key="index"
        class="flex flex-1 min-w-0 items-center"
        :class="[
          index < steps.length - 1 ? 'sm:flex-none' : '',
        ]"
        role="listitem"
      >
        <div class="flex flex-col items-center gap-1 text-center sm:flex-row sm:gap-2 sm:text-left">
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors"
            :class="
              index + 1 < currentStep
                ? 'bg-emerald-600 text-white'
                : index + 1 === currentStep
                  ? 'bg-primary-500 text-white ring-2 ring-primary-400 ring-offset-2 ring-offset-gray-900'
                  : 'bg-gray-700 text-gray-400'
            "
            :aria-current="index + 1 === currentStep ? 'step' : undefined"
            :aria-label="`Step ${index + 1}: ${step.label}`"
          >
            <template v-if="index + 1 < currentStep">✓</template>
            <template v-else>{{ index + 1 }}</template>
          </span>
          <span
            class="hidden text-xs font-medium sm:inline"
            :class="
              index + 1 <= currentStep ? 'text-gray-200' : 'text-gray-500'
            "
          >
            {{ step.shortLabel ?? step.label }}
          </span>
        </div>
        <div
          v-if="index < steps.length - 1"
          class="mx-1 hidden h-0.5 flex-1 bg-gray-600 sm:mx-2 sm:block"
          aria-hidden="true"
        />
      </li>
    </ol>
  </nav>
</template>
