<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      modelValue: string
      units?: string[]
      min?: number
      max?: number
      placeholder?: string
    }>(),
    {
      units: () => ['weeks', 'months', 'years'],
      min: 0,
      max: 120,
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: string]
  }>()

  function parseValue(val: string): { num: number; unit: string } {
    const defaultUnit = props.units[0] ?? 'months'
    if (!val || !val.trim()) return { num: 0, unit: defaultUnit }
    const m = val.match(/^(\d+)\s*(.+)$/)
    if (m) {
      const u = m[2]!.toLowerCase().trim()
      let normalized = defaultUnit
      for (const unit of props.units) {
        if (u.startsWith(unit) || unit.startsWith(u)) {
          normalized = unit
          break
        }
      }
      return { num: parseInt(m[1]!, 10), unit: normalized }
    }
    const numMatch = val.match(/^(\d+)/)
    if (numMatch) {
      return { num: parseInt(numMatch[1]!, 10), unit: defaultUnit }
    }
    return { num: 0, unit: defaultUnit }
  }

  const initial = parseValue(props.modelValue)
  const num = ref(initial.num)
  const unit = ref(initial.unit)

  watch(
    () => props.modelValue,
    (val) => {
      const p = parseValue(val)
      num.value = p.num
      unit.value = props.units.includes(p.unit) ? p.unit : (props.units[0] ?? 'months')
    },
    { immediate: true }
  )

  function emitValue() {
    const u = unit.value || (props.units[0] ?? 'months')
    const n = Math.min(props.max, Math.max(props.min, num.value))
    const next = n > 0 ? `${n} ${u}` : ''
    if (props.modelValue !== next) emit('update:modelValue', next)
  }

  watch([num, unit], emitValue, { deep: true })
</script>

<template>
  <div class="flex flex-wrap items-end gap-2">
    <AppInputNumber
      v-model="num"
      :min="min"
      :max="max"
      :placeholder="placeholder"
      input-width="w-20"
    />
    <div class="flex flex-col gap-1">
      <label class="text-xs text-gray-500 dark:text-gray-400">&nbsp;</label>
      <USelect
        v-model="unit"
        :items="units.map((u) => ({ label: u, value: u }))"
        value-key="value"
        class="min-w-[100px]"
      />
    </div>
  </div>
</template>
