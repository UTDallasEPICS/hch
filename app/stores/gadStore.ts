/**
 * GAD-7 Form Store
 * Mirrors Application form architecture but simplified.
 */

export interface GadFormState {
  g1: number | null
  g2: number | null
  g3: number | null
  g4: number | null
  g5: number | null
  g6: number | null
  g7: number | null
  g8: number | null
}

function createInitialState(): GadFormState {
  return {
    g1: null,
    g2: null,
    g3: null,
    g4: null,
    g5: null,
    g6: null,
    g7: null,
    g8: null,
  }
}

export interface GadAnswerPayload {
  g01?: number | null
  g02?: number | null
  g03?: number | null
  g04?: number | null
  g05?: number | null
  g06?: number | null
  g07?: number | null
  g08?: number | null
  totalScore?: number
  severity?: string
}

export function useGadStore() {
  const form = reactive<GadFormState>(createInitialState())

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

  function toPayload(): GadAnswerPayload {
    return {
      g01: form.g1,
      g02: form.g2,
      g03: form.g3,
      g04: form.g4,
      g05: form.g5,
      g06: form.g6,
      g07: form.g7,
      g08: form.g8,
      totalScore: totalScore.value,
      severity: severity.value,
    }
  }

  function applySavedAnswers(a?: GadAnswerPayload | null) {
    if (!a) return

    form.g1 = a.g01 ?? null
    form.g2 = a.g02 ?? null
    form.g3 = a.g03 ?? null
    form.g4 = a.g04 ?? null
    form.g5 = a.g05 ?? null
    form.g6 = a.g06 ?? null
    form.g7 = a.g07 ?? null
    form.g8 = a.g08 ?? null
  }

  return {
    form,
    totalScore,
    severity,
    toPayload,
    applySavedAnswers,
  }
}
