/**
 * Extracted question schema from PDF analysis.
 * Maps to the Question model types: radio, radio_other, checkbox, checkbox_other,
 * short_answer, long_paragraph, multiple_choice_grid, checkbox_grid
 */
export type ExtractedQuestionType =
  | 'radio'
  | 'radio_other'
  | 'checkbox'
  | 'checkbox_other'
  | 'short_answer'
  | 'long_paragraph'
  | 'multiple_choice_grid'
  | 'checkbox_grid'

export interface ExtractedQuestion {
  id: string
  text: string
  type: ExtractedQuestionType
  options?: string[]
  gridRows?: string[]
  gridCols?: string[]
  section?: string
  needsReview?: boolean
}

export type ExtractedFormQuestions = ExtractedQuestion[]
