<script setup lang="ts">
  const gadAnswered = ref(0)
  const gadTotal = ref(7)

  onMounted(async () => {
    try {
      const progress = await $fetch<{ answered: number; total: number }>('/api/gad/progress')

      gadAnswered.value = progress.answered
      gadTotal.value = progress.total
    } catch {
      gadAnswered.value = 0
      gadTotal.value = 7
    }
  })
</script>

<template>
  <UContainer class="py-10">
    <h1 class="text-2xl font-semibold">Tasks to Complete</h1>

    <div class="mt-6 space-y-4">
      <UButton
        class="w-full justify-between rounded-xl px-5 py-4"
        color="primary"
        variant="soft"
        to="/gad"
      >
        <span>GAD-7 Anxiety Assessment</span>
        <span>{{ gadAnswered }}/{{ gadTotal }}</span>
      </UButton>
    </div>
  </UContainer>
</template>
