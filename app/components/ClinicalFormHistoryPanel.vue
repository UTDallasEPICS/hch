<script setup lang="ts">
  type HistoryEvent = {
    id: string
    score: number | null
    severity: string | null
    recordedAt: string
    questions: { label: string; answer: string }[]
  }

  type HistoryRes = { events: HistoryEvent[] }

  const props = defineProps<{
    clientId: string
    formKey: string
  }>()

  const { data, pending, error, refresh } = await useFetch<HistoryRes>(
    () => `/api/clients/${props.clientId}/forms/${props.formKey}/history`,
    {
      watch: [() => props.clientId, () => props.formKey],
    }
  )

  defineExpose({ refresh })

  function formatWhen(iso: string) {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }
</script>

<template>
  <div class="min-h-0 flex-1 overflow-y-auto">
    <div v-if="pending" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="h-7 w-7 animate-spin text-gray-400" />
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      title="Could not load history"
      description="Try again later."
    />
    <div v-else-if="data?.events?.length" class="space-y-4">
      <div
        v-for="ev in data.events"
        :key="ev.id"
        class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2 dark:border-gray-800">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">
            {{ formatWhen(ev.recordedAt) }}
          </span>
          <div class="flex flex-wrap gap-2 text-sm">
            <span v-if="ev.score != null" class="font-semibold text-gray-900 dark:text-white">
              Score: {{ ev.score }}
            </span>
            <span v-if="ev.severity" class="text-gray-600 dark:text-gray-400">{{ ev.severity }}</span>
          </div>
        </div>
        <div v-if="ev.questions?.length" class="max-h-56 space-y-2 overflow-y-auto">
          <div
            v-for="(q, i) in ev.questions"
            :key="i"
            class="rounded border border-gray-100 bg-gray-50/80 p-2 text-sm dark:border-gray-800 dark:bg-gray-800/50"
          >
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ q.label }}</p>
            <p class="mt-0.5 whitespace-pre-wrap text-gray-900 dark:text-gray-100">
              {{ q.answer || '—' }}
            </p>
          </div>
        </div>
        <p v-else class="text-xs text-gray-500 dark:text-gray-400">
          Answers were not stored for this submission (older data).
        </p>
      </div>
    </div>
    <p v-else class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
      No past submissions for this assessment yet.
    </p>
  </div>
</template>
