<script setup lang="ts">
  const toast = useToast()
  const isSaving = ref(false)

  const form = reactive({
    g1: null as number | null,
    g2: null as number | null,
    g3: null as number | null,
    g4: null as number | null,
    g5: null as number | null,
    g6: null as number | null,
    g7: null as number | null,
    g8: null as number | null,
  })

  const options = [
    { label: 'Not at all', value: 0 },
    { label: 'Several days', value: 1 },
    { label: 'More than half the days', value: 2 },
    { label: 'Nearly every day', value: 3 },
  ]

  const difficultyOptions = [
    { label: 'Not difficult at all', value: 0 },
    { label: 'Somewhat difficult', value: 1 },
    { label: 'Very difficult', value: 2 },
    { label: 'Extremely difficult', value: 3 },
  ]

  const questionKeys = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7'] as const

  const totalScore = computed(() => {
    return (
      (form.g1 ?? 0) +
      (form.g2 ?? 0) +
      (form.g3 ?? 0) +
      (form.g4 ?? 0) +
      (form.g5 ?? 0) +
      (form.g6 ?? 0) +
      (form.g7 ?? 0)
    )
  })

  const severity = computed(() => {
    const s = totalScore.value
    if (s <= 4) return 'Minimal'
    if (s <= 9) return 'Mild'
    if (s <= 14) return 'Moderate'
    return 'Severe'
  })

  function applySavedAnswers(a: any) {
    if (!a) return
    form.g1 = a.g01
    form.g2 = a.g02
    form.g3 = a.g03
    form.g4 = a.g04
    form.g5 = a.g05
    form.g6 = a.g06
    form.g7 = a.g07
    form.g8 = a.g08
  }

  onMounted(async () => {
    const res = await $fetch('/api/gad/start', { method: 'POST' })
    applySavedAnswers(res?.answers)
  })

  async function saveAndExit() {
    try {
      isSaving.value = true

      await $fetch('/api/gad/save', {
        method: 'POST',
        body: form,
      })

      toast.add({
        title: 'Saved',
        color: 'success',
      })

      await navigateTo('/taskPage')
    } catch {
      toast.add({
        title: 'Save failed',
        color: 'error',
      })
    } finally {
      isSaving.value = false
    }
  }
</script>

<template>
  <UContainer class="max-w-3xl py-10">
    <h1 class="text-2xl font-semibold text-white">GAD-7 Anxiety Assessment</h1>

    <UCard class="mt-4">
      <p class="text-sm text-gray-400">
        Over the last <span class="font-medium">two weeks</span>, how often have you been bothered
        by the following problems?
      </p>
    </UCard>

    <UCard class="mt-6 space-y-6">
      <!-- Question Component -->
      <div v-for="(questionKey, index) in questionKeys" :key="questionKey" class="space-y-3">
        <label class="font-medium text-gray-200">
          {{
            [
              'Feeling nervous, anxious, or on edge',
              'Not being able to stop or control worrying',
              'Worrying too much about different things',
              'Trouble relaxing',
              'Being so restless that it is hard to sit still',
              'Becoming easily annoyed or irritable',
              'Feeling afraid, as if something awful might happen',
            ][index]
          }}
        </label>

        <div class="space-y-2">
          <label
            v-for="opt in options"
            :key="opt.value"
            class="flex cursor-pointer items-center gap-3"
          >
            <input
              type="radio"
              :value="opt.value"
              v-model="form[questionKey as keyof typeof form]"
              class="accent-primary-500 h-4 w-4"
            />

            <span class="text-sm text-gray-300">
              {{ opt.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Difficulty Question -->
      <div class="space-y-3">
        <label class="font-medium text-gray-200">
          If you checked any problems, how difficult have they made it for you?
        </label>

        <div class="space-y-2">
          <label
            v-for="opt in difficultyOptions"
            :key="opt.value"
            class="flex cursor-pointer items-center gap-3"
          >
            <input
              type="radio"
              :value="opt.value"
              v-model="form.g8"
              class="accent-primary-500 h-4 w-4"
            />

            <span class="text-sm text-gray-300">
              {{ opt.label }}
            </span>
          </label>
        </div>
      </div>

      <!-- Score -->
      <UCard>
        <div class="text-lg font-semibold text-white">Total Score: {{ totalScore }}</div>

        <div class="text-sm text-gray-400">Severity: {{ severity }}</div>
      </UCard>
    </UCard>

    <div class="mt-8">
      <UButton label="Save and Exit" :loading="isSaving" @click="saveAndExit" />
    </div>
  </UContainer>
</template>
