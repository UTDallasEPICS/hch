<script setup lang="ts">
  const props = defineProps<{
    modelValue: string
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
  }>()

  const options = [
    { value: 'show', label: 'Show' },
    { value: 'no-show', label: 'No show' },
    { value: 'canceled', label: 'Canceled' },
    { value: 'late-canceled', label: 'Late canceled' },
    { value: 'clinician-canceled', label: 'Clinician canceled' },
  ]

  const selected = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
  })

  const selectClass = computed(() => {
    if (props.disabled) {
      return 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
    }
    if (selected.value === 'show') {
      return 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400'
    }
    if (selected.value && selected.value !== 'show') {
      return 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
    }
    // default - no selection yet
    return 'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
  })
</script>

<template>
  <div class="relative w-48">
    <select
      v-model="selected"
      :disabled="disabled"
      class="w-full appearance-none rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed"
      :class="selectClass"
    >
      <option value="" disabled hidden>Attendance Status</option>
      <option
        v-for="opt in options"
        :key="opt.value"
        :value="opt.value"
        class="bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {{ opt.label }}
      </option>
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-2 flex items-center">
      <svg class="h-4 w-4 opacity-50" viewBox="0 0 20 20" fill="currentColor">
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </div>
  </div>
</template>
