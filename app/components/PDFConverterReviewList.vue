<script setup lang="ts">
import type { ExtractedQuestion } from '~/types/pdf-form'

const props = defineProps<{
  questions: ExtractedQuestion[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  approve: [question: ExtractedQuestion]
  reject: [question: ExtractedQuestion]
  approveAll: []
}>()

const QUESTION_TYPE_LABELS: Record<string, string> = {
  radio: 'Radio (Single Choice)',
  radio_other: 'Radio with "Other"',
  checkbox: 'Checkbox (Multiple Choice)',
  checkbox_other: 'Checkbox with "Other"',
  short_answer: 'Short Answer',
  long_paragraph: 'Long Paragraph',
  multiple_choice_grid: 'Multiple Choice Grid',
  checkbox_grid: 'Checkbox Grid',
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
      Review detected questions. Approve to add them to the form.
    </p>
    <ul class="space-y-3">
      <li
        v-for="(q, idx) in questions"
        :key="q.id"
        class="rounded-lg border p-4 transition"
        :class="[
          q.needsReview
            ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-900/20'
            : 'border-gray-200 dark:border-gray-700',
        ]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {{ idx + 1 }}. {{ q.text }}
              </span>
              <span
                v-if="q.needsReview"
                class="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-200"
              >
                Needs review
              </span>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ QUESTION_TYPE_LABELS[q.type] || q.type }}
              <template v-if="q.section"> · {{ q.section }}</template>
            </p>
            <div v-if="q.options?.length" class="mt-2 flex flex-wrap gap-1">
              <span
                v-for="opt in q.options"
                :key="opt"
                class="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800"
              >
                {{ opt }}
              </span>
            </div>
            <div
              v-if="q.gridRows?.length || q.gridCols?.length"
              class="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400"
            >
              <div v-if="q.gridRows?.length">
                Rows: {{ q.gridRows.join(', ') }}
              </div>
              <div v-if="q.gridCols?.length">
                Cols: {{ q.gridCols.join(', ') }}
              </div>
            </div>
          </div>
          <div class="flex shrink-0 gap-1">
            <UButton
              size="xs"
              color="primary"
              :disabled="disabled"
              @click="emit('approve', q)"
            >
              Approve
            </UButton>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              :disabled="disabled"
              @click="emit('reject', q)"
            >
              Skip
            </UButton>
          </div>
        </div>
      </li>
    </ul>
    <UButton
      size="sm"
      variant="outline"
      color="primary"
      :disabled="disabled || !questions.length"
      @click="emit('approveAll')"
    >
      Approve All
    </UButton>
  </div>
</template>
