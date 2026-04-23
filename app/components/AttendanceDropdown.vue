<script setup lang="ts">
  const props = defineProps<{
    modelValue: string
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
</script>

<template>
  <USelect
    v-model="selected"
    :options="options"
    option-attribute="label"
    value-attribute="value"
    placeholder="Select status"
    class="w-48"
  />
</template>
