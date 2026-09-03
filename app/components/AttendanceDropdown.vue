<script setup lang="ts">
  import { ATTENDANCE_STATUSES, getAttendanceStatusMeta } from '~/utils/attendance-status'

  const props = defineProps<{
    modelValue: string
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
  }>()

  const options = ATTENDANCE_STATUSES

  const selected = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
  })

  // Base look; the selected status tints border/text/background via inline style
  // from the shared attendance-status color map (#32).
  const baseSelectClass =
    'border-gray-300 bg-white text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
  const disabledSelectClass =
    'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'

  const selectClass = computed(() => (props.disabled ? disabledSelectClass : baseSelectClass))

  const selectStyle = computed(() => {
    if (props.disabled) return {}
    const color = getAttendanceStatusMeta(selected.value)?.color
    if (!color) return {}
    return { borderColor: color, color, backgroundColor: `${color}14` }
  })
</script>

<template>
  <div class="relative w-48">
    <select
      v-model="selected"
      :disabled="disabled"
      class="w-full appearance-none rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none disabled:cursor-not-allowed"
      :class="selectClass"
      :style="selectStyle"
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
