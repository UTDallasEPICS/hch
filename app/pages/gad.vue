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

      await navigateTo('/tasks')
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
  <UContainer class="py-10">
    <h1 class="text-2xl font-semibold">GAD-7 Anxiety Assessment</h1>

    <UCard class="mt-6 space-y-6">
      <div>
        <label>1. Feeling nervous, anxious, or on edge</label>
        <URadioGroup v-model="form.g1" :options="options" />
      </div>

      <div>
        <label>2. Not being able to stop or control worrying</label>
        <URadioGroup v-model="form.g2" :options="options" />
      </div>

      <div>
        <label>3. Worrying too much about different things</label>
        <URadioGroup v-model="form.g3" :options="options" />
      </div>

      <div>
        <label>4. Trouble relaxing</label>
        <URadioGroup v-model="form.g4" :options="options" />
      </div>

      <div>
        <label>5. Being so restless that it is hard to sit still</label>
        <URadioGroup v-model="form.g5" :options="options" />
      </div>

      <div>
        <label>6. Becoming easily annoyed or irritable</label>
        <URadioGroup v-model="form.g6" :options="options" />
      </div>

      <div>
        <label>7. Feeling afraid, as if something awful might happen</label>
        <URadioGroup v-model="form.g7" :options="options" />
      </div>

      <div>
        <label> If you checked any problems, how difficult have they made it for you? </label>
        <URadioGroup v-model="form.g8" :options="difficultyOptions" />
      </div>

      <UCard>
        <div class="text-lg font-semibold">Total Score: {{ totalScore }}</div>

        <div class="text-sm">Severity: {{ severity }}</div>
      </UCard>
    </UCard>

    <div class="mt-8">
      <UButton label="Save and Exit" :loading="isSaving" @click="saveAndExit" />
    </div>
  </UContainer>
</template>
