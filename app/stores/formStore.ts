/**
 * Hope. Cope. Heal. — Application form state
 * Maps to PDF question schema; first_name (Q2) is the semantic data key.
 * Payload keys q1–q51 match the API/backend.
 */

const QUESTION_DETAIL_FIELDS: Record<number, string> = {
  6: 'q6Text',
  12: 'q12Text',
  17: 'q17Text',
  19: 'q19Text',
  28: 'q28Text',
  37: 'q37Other',
  38: 'q38Text',
  39: 'q39Text',
  43: 'q43Text',
  45: 'q45Text',
  46: 'q46Other',
  47: 'q47Text',
  48: 'q48Text',
  50: 'q50Text',
  51: 'q51Text',
}

export interface ApplicationFormState {
  q1: string
  q2: string
  q3: string
  q4: string
  q5: string
  q6: string
  q6Text: string
  q7: string
  q8: string
  q9: string
  q10: string
  q11: string
  q12: string
  q12Text: string
  q13: string
  q14: string
  q15: string
  q16: string
  q17: string
  q17Text: string
  q18: string[]
  q18Other: string
  q19: string
  q19Text: string
  q20: string
  q21: string
  q22: string
  q23: string
  q24: string
  q25: string
  q26: string
  q27: string
  q28: string
  q28Text: string
  q29: string
  q30: string
  q31: string
  q32: string
  q33: string
  q34: string
  q35: string
  q36: string
  q37: string
  q37Other: string
  q38: string
  q38Text: string
  q39: string
  q39Text: string
  q40: string
  q41: string
  q42: string
  q43: string
  q43Text: string
  q44: string
  q45: string
  q45Text: string
  q46: string
  q46Other: string
  q47: string
  q47Text: string
  q48: string
  q48Text: string
  q49: string
  q50: string
  q50Text: string
  q51: string
  q51Text: string
}

function createInitialState(): ApplicationFormState {
  return {
    q1: '',
    q2: '',
    q3: '',
    q4: '',
    q5: '',
    q6: '',
    q6Text: '',
    q7: '',
    q8: '',
    q9: '',
    q10: '',
    q11: '',
    q12: '',
    q12Text: '',
    q13: '',
    q14: '',
    q15: '',
    q16: '',
    q17: '',
    q17Text: '',
    q18: [],
    q18Other: '',
    q19: '',
    q19Text: '',
    q20: '',
    q21: '',
    q22: '',
    q23: '',
    q24: '',
    q25: '',
    q26: '',
    q27: '',
    q28: '',
    q28Text: '',
    q29: '',
    q30: '',
    q31: '',
    q32: '',
    q33: '',
    q34: '',
    q35: '',
    q36: '',
    q37: '',
    q37Other: '',
    q38: '',
    q38Text: '',
    q39: '',
    q39Text: '',
    q40: '',
    q41: '',
    q42: '',
    q43: '',
    q43Text: '',
    q44: '',
    q45: '',
    q45Text: '',
    q46: '',
    q46Other: '',
    q47: '',
    q47Text: '',
    q48: '',
    q48Text: '',
    q49: '',
    q50: '',
    q50Text: '',
    q51: '',
    q51Text: '',
  }
}

export type AppAnswerPayload = Record<string, string | null | undefined>

/**
 * Form store composable.
 * Q2 is exposed as first_name (PDF data key); internally stored as q2.
 */
export function useFormStore() {
  const form = reactive<ApplicationFormState>(createInitialState())

  /** Semantic key for Q2: "His Name" → first_name (PDF) */
  const first_name = computed({
    get: () => form.q2,
    set: (v: string) => { form.q2 = v },
  })

  /**
   * Build API payload q1–q51 from current state.
   * Matches backend expectation (q01–q51 in DB; API accepts q1–q51).
   */
  function toPayload(): Record<string, string> {
    const payload: Record<string, string> = {}
    for (let index = 1; index <= 51; index += 1) {
      if (index === 18) {
        payload.q18 = JSON.stringify(form.q18 ?? [])
        continue
      }
      const detailKey = QUESTION_DETAIL_FIELDS[index as keyof typeof QUESTION_DETAIL_FIELDS]
      if (detailKey) {
        const mainKey = `q${index}` as keyof ApplicationFormState
        const selected = form[mainKey]
        const detail = form[detailKey as keyof ApplicationFormState]
        const selectedStr = typeof selected === 'string' ? selected : ''
        const detailStr = typeof detail === 'string' ? detail : ''
        if (selectedStr === '' && detailStr === '') {
          payload[`q${index}`] = ''
        } else {
          payload[`q${index}`] = JSON.stringify({ value: selectedStr, text: detailStr })
        }
        continue
      }
      const value = form[`q${index}` as keyof ApplicationFormState]
      payload[`q${index}`] = typeof value === 'string' ? value : ''
    }
    return payload
  }

  /**
   * Hydrate form from API response (e.g. /api/application/start).
   * Expects keys q01–q51.
   */
  function applySavedAnswers(answers?: AppAnswerPayload | null) {
    if (!answers) return
    for (let index = 1; index <= 51; index += 1) {
      const key = `q${String(index).padStart(2, '0')}`
      const value = answers[key]
      if (index === 18) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value)
            form.q18 = Array.isArray(parsed) ? parsed : []
          } catch {
            form.q18 = []
          }
        }
        continue
      }
      const detailKey = QUESTION_DETAIL_FIELDS[index as keyof typeof QUESTION_DETAIL_FIELDS]
      if (detailKey) {
        const mainKey = `q${index}` as keyof ApplicationFormState
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value) as { value?: string; text?: string }
            form[mainKey] = (parsed.value ?? '') as ApplicationFormState[keyof ApplicationFormState]
            form[detailKey as keyof ApplicationFormState] = (parsed.text ?? '') as ApplicationFormState[keyof ApplicationFormState]
          } catch {
            form[mainKey] = (value ?? '') as ApplicationFormState[keyof ApplicationFormState]
            form[detailKey as keyof ApplicationFormState] = '' as ApplicationFormState[keyof ApplicationFormState]
          }
        } else {
          form[mainKey] = '' as ApplicationFormState[keyof ApplicationFormState]
          form[detailKey as keyof ApplicationFormState] = '' as ApplicationFormState[keyof ApplicationFormState]
        }
        continue
      }
      const formKey = `q${index}` as keyof ApplicationFormState
      form[formKey] = (value ?? '') as ApplicationFormState[keyof ApplicationFormState]
    }
  }

  return {
    form,
    first_name,
    toPayload,
    applySavedAnswers,
  }
}
