/**
 * Hope. Cope. Heal. — Application form state
 * Maps to PDF question schema; first_name (Q2) is the semantic data key.
 * Payload keys q1–q50 match the API/backend.
 */

const TOTAL_PAYLOAD_QUESTIONS = 50

function toFormQuestionNumber(payloadQuestionNumber: number): number | null {
  if (payloadQuestionNumber >= 4 && payloadQuestionNumber <= 49) {
    return payloadQuestionNumber + 1
  }

  if (payloadQuestionNumber === 50) {
    return 51
  }

  return payloadQuestionNumber
}

const QUESTION_DETAIL_FIELDS: Record<number, string> = {
  17: 'q17Text',
  37: 'q37Other',
  46: 'q46Other',
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
  q48: string[]
  q49: string
  q50: string
  q50Text: string
  q51: string
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
    q48: [],
    q49: '',
    q50: '',
    q50Text: '',
    q51: '',
  }
}

export type AppAnswerPayload = Record<string, string | null | undefined>

/**
 * Form store composable.
 * Q2 is exposed as first_name (PDF data key); internally stored as q2.
 */
export function useFormStore() {
  const form = useState<ApplicationFormState>('application-form-state', createInitialState)

  /** Semantic key for Q2: "First Name" → first_name (PDF) */
  const first_name = computed({
    get: () => form.value.q2,
    set: (v: string) => {
      form.value.q2 = v
    },
  })

  /**
   * Build API payload q1–q50 from current state.
   * Backend stores q01–q50.
   * Legacy internal keys are offset by +1 from q4 onward (q5 -> payload q4, ..., q50 -> payload q49).
   */
  function toPayload(): Record<string, string> {
    const payload: Record<string, string> = {}
    for (let payloadIndex = 1; payloadIndex <= TOTAL_PAYLOAD_QUESTIONS; payloadIndex += 1) {
      const formIndex = toFormQuestionNumber(payloadIndex)

      if (formIndex === null) {
        payload[`q${payloadIndex}`] = ''
        continue
      }

      if (formIndex === 18) {
        const selections = form.value.q18 ?? []
        const other = form.value.q18Other ?? ''

        if (selections.length === 0 && other.trim() === '') {
          payload[`q${payloadIndex}`] = ''
        } else {
          payload[`q${payloadIndex}`] = JSON.stringify({
            values: selections,
            other,
          })
        }
        continue
      }

      if (formIndex === 48) {
        const selections = form.value.q48 ?? []
        payload[`q${payloadIndex}`] = JSON.stringify(Array.isArray(selections) ? selections : [])
        continue
      }

      const detailKey = QUESTION_DETAIL_FIELDS[formIndex as keyof typeof QUESTION_DETAIL_FIELDS]
      if (detailKey) {
        const mainKey = `q${formIndex}` as keyof ApplicationFormState
        const selected = form.value[mainKey]
        const detail = form.value[detailKey as keyof ApplicationFormState]
        const selectedStr = typeof selected === 'string' ? selected : ''
        const detailStr = typeof detail === 'string' ? detail : ''
        if (selectedStr === '' && detailStr === '') {
          payload[`q${payloadIndex}`] = ''
        } else {
          payload[`q${payloadIndex}`] = JSON.stringify({ value: selectedStr, text: detailStr })
        }
        continue
      }
      const value = form.value[`q${formIndex}` as keyof ApplicationFormState]
      if (formIndex === 5 || formIndex === 25 || formIndex === 34) {
        payload[`q${payloadIndex}`] = typeof value === 'string' ? value.replace(/\D+/g, '') : ''
      } else {
        payload[`q${payloadIndex}`] = typeof value === 'string' ? value : ''
      }
    }
    return payload
  }

  /**
   * Hydrate form from API response (e.g. /api/application/start).
   * Expects keys q01–q50.
   */
  function applySavedAnswers(answers?: AppAnswerPayload | null) {
    Object.assign(form.value, createInitialState())
    if (!answers) return
    const mutable = form.value as unknown as Record<string, string | string[]>
    for (let payloadIndex = 1; payloadIndex <= TOTAL_PAYLOAD_QUESTIONS; payloadIndex += 1) {
      const key = `q${String(payloadIndex).padStart(2, '0')}`
      const value = answers[key]
      const formIndex = toFormQuestionNumber(payloadIndex)

      if (formIndex === null) {
        continue
      }

      if (formIndex === 18) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value)

            if (Array.isArray(parsed)) {
              form.value.q18 = parsed
              form.value.q18Other = ''
            } else if (parsed && typeof parsed === 'object') {
              const values = Array.isArray((parsed as { values?: unknown }).values)
                ? ((parsed as { values: string[] }).values ?? [])
                : []
              const other =
                typeof (parsed as { other?: unknown }).other === 'string'
                  ? ((parsed as { other: string }).other ?? '')
                  : ''

              form.value.q18 = values
              form.value.q18Other = other
            } else {
              form.value.q18 = []
              form.value.q18Other = ''
            }
          } catch {
            form.value.q18 = []
            form.value.q18Other = ''
          }
        } else {
          form.value.q18 = []
          form.value.q18Other = ''
        }
        continue
      }

      if (formIndex === 48) {
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value)
            form.value.q48 = Array.isArray(parsed) ? parsed : []
          } catch {
            form.value.q48 = []
          }
        } else {
          form.value.q48 = []
        }
        continue
      }
      const detailKey = QUESTION_DETAIL_FIELDS[formIndex as keyof typeof QUESTION_DETAIL_FIELDS]
      if (detailKey) {
        const mainKey = `q${formIndex}` as keyof ApplicationFormState
        if (typeof value === 'string' && value.length > 0) {
          try {
            const parsed = JSON.parse(value) as { value?: string; text?: string }
            mutable[String(mainKey)] = parsed.value ?? ''
            mutable[String(detailKey)] = parsed.text ?? ''
          } catch {
            mutable[String(mainKey)] = value ?? ''
            mutable[String(detailKey)] = ''
          }
        } else {
          mutable[String(mainKey)] = ''
          mutable[String(detailKey)] = ''
        }
        continue
      }
      const formKey = `q${formIndex}` as keyof ApplicationFormState
      mutable[String(formKey)] = value ?? ''
    }
  }

  return {
    form,
    first_name,
    toPayload,
    applySavedAnswers,
  }
}
