import { createError } from 'h3'

// Input parsing and response shapes for medication and trauma history
// (#223). Shared by the client CRUD routes and the staff read-only routes.

export const SHORT_TEXT_MAX_LENGTH = 200
export const LONG_TEXT_MAX_LENGTH = 2000

// proofPath / proofName are left out on purpose: proof uploads are handled
// separately (#225) and the stored path should never reach the browser.
export const medicationHistorySelect = {
  id: true,
  name: true,
  dosage: true,
  frequency: true,
  prescriber: true,
  startDate: true,
  endDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const

export const traumaHistorySelect = {
  id: true,
  category: true,
  description: true,
  approximateDate: true,
  createdAt: true,
  updatedAt: true,
} as const

export type MedicationHistoryInput = {
  name: string
  dosage: string
  frequency: string
  prescriber: string | null
  startDate: Date
  endDate: Date | null
  notes: string | null
}

export type TraumaHistoryInput = {
  category: string
  description: string
  approximateDate: Date | null
}

function badRequest(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

function asBody(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    badRequest('Invalid request body')
  }
  return raw as Record<string, unknown>
}

function isBlank(raw: unknown) {
  return raw === undefined || raw === null || raw === ''
}

function requiredText(raw: unknown, label: string, max: number): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    badRequest(`${label} is required`)
  }
  const text = raw.trim()
  if (text.length > max) {
    badRequest(`${label} must be at most ${max} characters`)
  }
  return text
}

function optionalText(raw: unknown, label: string, max: number): string | null {
  if (isBlank(raw)) return null
  if (typeof raw !== 'string') {
    badRequest(`${label} must be text`)
  }
  const text = raw.trim()
  if (!text) return null
  if (text.length > max) {
    badRequest(`${label} must be at most ${max} characters`)
  }
  return text
}

function parseDate(raw: unknown, label: string): Date {
  const date = typeof raw === 'string' ? new Date(raw) : null
  if (!date || Number.isNaN(date.getTime())) {
    badRequest(`${label} must be a valid date`)
  }
  return date
}

function requiredDate(raw: unknown, label: string): Date {
  if (isBlank(raw)) {
    badRequest(`${label} is required`)
  }
  return parseDate(raw, label)
}

function optionalDate(raw: unknown, label: string): Date | null {
  return isBlank(raw) ? null : parseDate(raw, label)
}

/**
 * On update, a field missing from the body keeps its current value, so PATCH
 * can send only what changed while cross-field rules still see the full record.
 */
function field<T, K extends keyof T & string>(
  body: Record<string, unknown>,
  current: T | undefined,
  key: K,
  parse: (raw: unknown) => T[K]
): T[K] {
  if (current && !Object.prototype.hasOwnProperty.call(body, key)) return current[key]
  return parse(body[key])
}

/**
 * Validates a medication history body. Pass `current` (the stored record) for
 * PATCH; omit it for POST, where every required field must be present.
 */
export function parseMedicationInput(
  raw: unknown,
  current?: MedicationHistoryInput
): MedicationHistoryInput {
  const body = asBody(raw)
  const value: MedicationHistoryInput = {
    name: field(body, current, 'name', (v) => requiredText(v, 'Name', SHORT_TEXT_MAX_LENGTH)),
    dosage: field(body, current, 'dosage', (v) => requiredText(v, 'Dosage', SHORT_TEXT_MAX_LENGTH)),
    frequency: field(body, current, 'frequency', (v) =>
      requiredText(v, 'Frequency', SHORT_TEXT_MAX_LENGTH)
    ),
    prescriber: field(body, current, 'prescriber', (v) =>
      optionalText(v, 'Prescriber', SHORT_TEXT_MAX_LENGTH)
    ),
    startDate: field(body, current, 'startDate', (v) => requiredDate(v, 'Start date')),
    endDate: field(body, current, 'endDate', (v) => optionalDate(v, 'End date')),
    notes: field(body, current, 'notes', (v) => optionalText(v, 'Notes', LONG_TEXT_MAX_LENGTH)),
  }
  if (value.endDate && value.endDate < value.startDate) {
    badRequest('End date cannot be before start date')
  }
  return value
}

/**
 * Validates a trauma history body. Pass `current` (the stored record) for
 * PATCH; omit it for POST.
 */
export function parseTraumaInput(raw: unknown, current?: TraumaHistoryInput): TraumaHistoryInput {
  const body = asBody(raw)
  const value: TraumaHistoryInput = {
    category: field(body, current, 'category', (v) =>
      requiredText(v, 'Category', SHORT_TEXT_MAX_LENGTH)
    ),
    description: field(body, current, 'description', (v) =>
      requiredText(v, 'Description', LONG_TEXT_MAX_LENGTH)
    ),
    approximateDate: field(body, current, 'approximateDate', (v) =>
      optionalDate(v, 'Approximate date')
    ),
  }
  if (value.approximateDate && value.approximateDate.getTime() > Date.now()) {
    badRequest('Approximate date cannot be in the future')
  }
  return value
}
