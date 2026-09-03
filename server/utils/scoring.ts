export function calculatePhqScore(questions: Record<string, any> | undefined): {
  score: number | null
  severity: string | null
} {
  if (!questions) return { score: null, severity: null }

  let score = 0
  let answered = false
  for (let i = 1; i <= 9; i++) {
    const key = `q${i}`
    const val = questions[key]
    if (typeof val === 'number' && val >= 0) {
      score += val
      answered = true
    }
  }

  if (!answered) return { score: null, severity: null }

  let severity = 'Minimal or no depression'
  if (score > 19) severity = 'Severe depression'
  else if (score > 14) severity = 'Moderately severe depression'
  else if (score > 9) severity = 'Moderate depression'
  else if (score > 4) severity = 'Mild depression'

  return { score, severity }
}

export function calculateGadScore(questions: Record<string, any> | undefined): {
  score: number | null
  severity: string | null
} {
  if (!questions) return { score: null, severity: null }

  // GAD-7 is scored on items g01–g07 (g08 is the functional-difficulty item and is
  // not part of the total).
  let score = 0
  let answered = false
  for (let i = 1; i <= 7; i++) {
    const key = `g${String(i).padStart(2, '0')}`
    const val = questions[key]
    if (typeof val === 'number' && val >= 0) {
      score += val
      answered = true
    }
  }

  if (!answered) return { score: null, severity: null }

  let severity = 'Minimal'
  if (score >= 15) severity = 'Severe'
  else if (score >= 10) severity = 'Moderate'
  else if (score >= 5) severity = 'Mild'

  return { score, severity }
}

/**
 * Canonical PCL-5 answer keys as stored on PclQuestion (`q01`–`q20`). Single
 * source of truth for the DB column format, shared by scoring and the form
 * save/submit handlers (#96).
 */
export const PCL_QUESTION_KEYS: string[] = Array.from(
  { length: 20 },
  (_, i) => `q${String(i + 1).padStart(2, '0')}`
)

export function calculatePclScore(questions: Record<string, any> | undefined): {
  score: number | null
  severity: string | null
} {
  if (!questions) return { score: null, severity: null }

  let score = 0
  let answered = false
  for (const key of PCL_QUESTION_KEYS) {
    const val = questions[key]
    if (typeof val === 'number' && val >= 0) {
      score += val
      answered = true
    }
  }

  if (!answered) return { score: null, severity: null }

  let severity = 'Minimal'
  if (score > 60) severity = 'Severe'
  else if (score > 40) severity = 'Moderate'
  else if (score > 20) severity = 'Mild'

  return { score, severity }
}

export function calculateAceScore(questions: Record<string, any> | undefined): {
  score: number | null
  severity: string | null
} {
  if (!questions) return { score: null, severity: null }

  let score = 0
  let answered = false
  for (let i = 1; i <= 10; i++) {
    const key = `a${String(i).padStart(2, '0')}`
    const val = questions[key]
    if (val === 'Yes' || val === true) {
      score += 1
    }
    if (val !== null && val !== undefined) {
      answered = true
    }
  }

  if (!answered) return { score: null, severity: null }

  let severity = 'Low risk'
  if (score >= 4) severity = 'High risk'
  else if (score >= 1) severity = 'Moderate risk'

  return { score, severity }
}
