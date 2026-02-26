<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      modelValue: string
      minYear?: number
      maxYear?: number
      placeholder?: string
    }>(),
    {
      minYear: 1900,
      maxYear: () => new Date().getFullYear() + 1,
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  function parseDate(val: string) {
    if (!val || !val.trim()) return null
    const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (m) {
      return { year: parseInt(m[1]!, 10), month: parseInt(m[2]!, 10), day: parseInt(m[3]!, 10) }
    }
    return null
  }

  function toISO(y: number, m: number, d: number) {
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  const defaultYear = new Date().getFullYear()
  const initial = parseDate(props.modelValue)

  const month = ref(initial?.month ?? 1)
  const day = ref(initial?.day ?? 1)
  const year = ref(initial?.year ?? defaultYear)

  function clampDay() {
    const daysInMonth = new Date(year.value, month.value, 0).getDate()
    if (day.value > daysInMonth) day.value = daysInMonth
    if (day.value < 1) day.value = 1
  }

  watch(
    () => props.modelValue,
    (val) => {
      const p = parseDate(val)
      if (p) {
        month.value = Math.min(12, Math.max(1, p.month))
        year.value = Math.min(props.maxYear, Math.max(props.minYear, p.year))
        day.value = p.day
        clampDay()
      }
    },
    { immediate: true }
  )

  function emitDate() {
    clampDay()
    const next = toISO(year.value, month.value, day.value)
    if (props.modelValue !== next) emit('update:modelValue', next)
  }

  watch([month, day, year], emitDate, { deep: true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <div class="flex flex-col gap-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">Month</label>
      <AppInputNumber
        v-model="month"
        :min="1"
        :max="12"
        placeholder="MM"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">Day</label>
      <AppInputNumber
        v-model="day"
        :min="1"
        :max="31"
        placeholder="DD"
      />
    </div>
    <div class="flex flex-col gap-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">Year</label>
      <AppInputNumber
        v-model="year"
        :min="minYear"
        :max="maxYear"
        placeholder="YYYY"
        input-width="w-20"
      />
    </div>
  </div>
</template>
