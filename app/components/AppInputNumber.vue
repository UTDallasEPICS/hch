<script setup lang="ts">
  const props = withDefaults(
    defineProps<{
      modelValue: number | string
      min?: number
      max?: number
      placeholder?: string
      size?: 'xs' | 'sm' | 'md' | 'lg'
      step?: number
      inputWidth?: string
    }>(),
    {
      min: 0,
      max: 999,
      size: 'md',
      step: 1,
    inputWidth: 'w-16',
    }
  )

  const emit = defineEmits<{
    'update:modelValue': [value: number | string]
  }>()

  const numValue = computed({
    get: () => {
      const v = props.modelValue
      if (v === '' || v === null || v === undefined) return null
      if (typeof v === 'number' && !Number.isNaN(v)) return v
      const parsed = parseInt(String(v || ''), 10)
      return Number.isNaN(parsed) ? null : parsed
    },
    set: (v: number | null) => emit('update:modelValue', v === null ? '' : v),
  })

  function increment() {
    const current = numValue.value ?? props.min
    const next = Math.min(current + props.step, props.max)
    numValue.value = next
  }

  function decrement() {
    const current = numValue.value ?? props.min
    const next = Math.max(current - props.step, props.min)
    numValue.value = next
  }

  function onInput(e: Event) {
    const raw = (e.target as HTMLInputElement).value
    if (raw === '') {
      emit('update:modelValue', '')
      return
    }
    const n = parseInt(raw, 10)
    if (!Number.isNaN(n)) {
      emit('update:modelValue', Math.min(Math.max(n, props.min), props.max))
    }
  }
</script>

<template>
  <div
    class="inline-flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
  >
    <button
      type="button"
      class="flex h-10 shrink-0 items-center justify-center border-r border-gray-300 px-3 text-gray-600 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
      aria-label="Decrease"
      :disabled="(numValue ?? min) <= min"
      @click="decrement"
    >
      <UIcon name="i-heroicons-minus-20-solid" class="h-4 w-4" />
    </button>
    <input
      type="number"
      :value="numValue ?? ''"
      :min="min"
      :max="max"
      :placeholder="placeholder"
      :class="[
        'h-10 shrink-0 border-0 bg-transparent px-2 text-center text-gray-900 outline-none [appearance:textfield] placeholder:text-gray-500 dark:text-gray-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        inputWidth,
      ]"
      inputmode="numeric"
      @input="onInput"
    />
    <button
      type="button"
      class="flex h-10 shrink-0 items-center justify-center border-l border-gray-300 px-3 text-primary-600 transition hover:bg-primary-50 dark:border-gray-600 dark:text-primary-400 dark:hover:bg-primary-900/30"
      aria-label="Increase"
      :disabled="(numValue ?? min) >= max"
      @click="increment"
    >
      <UIcon name="i-heroicons-plus-20-solid" class="h-4 w-4" />
    </button>
  </div>
</template>
