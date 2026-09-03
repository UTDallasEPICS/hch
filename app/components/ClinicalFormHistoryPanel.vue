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
  const openSubmissionId = ref<string | null>(null)

  function toggleSubmission(id: string) {
    openSubmissionId.value = openSubmissionId.value === id ? null : id
  }

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
    <div v-else-if="data?.events?.length" class="space-y-3">
      <div
        v-for="ev in data.events"
        :key="ev.id"
        class="rounded-xl border border-[#233a63] bg-[#0b1930] p-4 text-gray-100"
      >
        <button
          type="button"
          class="mb-2 flex w-full flex-wrap items-center justify-between gap-2 border-b border-[#2a426f] pb-2 text-left"
          @click="toggleSubmission(ev.id)"
        >
          <span class="text-xs font-medium text-gray-300">
            {{ formatWhen(ev.recordedAt) }}
          </span>
          <div class="flex flex-wrap items-center gap-2 text-sm leading-none">
            <span v-if="ev.score != null" class="text-white">
              Score: <span class="font-bold text-yellow-300">{{ ev.score }}</span>
            </span>
            <span v-if="ev.severity" class="text-sm text-gray-300">{{ ev.severity }}</span>
            <span class="text-sm text-cyan-300 hover:text-cyan-200">
              {{ openSubmissionId === ev.id ? 'Close submission' : 'Open submission' }}
            </span>
          </div>
        </button>
        <div
          v-if="openSubmissionId === ev.id && ev.questions?.length"
          class="max-h-56 space-y-2 overflow-y-auto pt-1"
        >
          <div
            v-for="(q, i) in ev.questions"
            :key="i"
            class="rounded border border-[#2a426f] bg-[#122746] p-2 text-sm"
          >
            <p class="text-xs font-medium text-gray-300">{{ q.label }}</p>
            <p class="mt-0.5 whitespace-pre-wrap text-gray-100">
              {{ q.answer || '—' }}
            </p>
          </div>
        </div>
        <p v-else-if="openSubmissionId === ev.id" class="text-xs text-gray-300">
          Answers were not stored for this submission (older data).
        </p>
      </div>
    </div>
    <p v-else class="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
      No past submissions for this assessment yet.
    </p>
  </div>
</template>
