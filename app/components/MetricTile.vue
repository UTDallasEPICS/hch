<script setup lang="ts">
  defineProps<{
    label: string
    value: number | string
    unit?: string
    hint?: string
  }>()
</script>

<template>
  <article
    class="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-700 dark:bg-gray-800"
  >
    <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ label }}</p>
    <div class="mt-3 flex flex-wrap items-end gap-2">
      <span class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ value }}
      </span>
      <span v-if="unit" class="text-sm text-gray-600 dark:text-gray-300">{{ unit }}</span>
      <slot name="badge" />
    </div>
    <p v-if="hint || $slots.hint" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
      <slot name="hint">{{ hint }}</slot>
    </p>
  </article>
</template>
