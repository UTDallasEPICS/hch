import { createError } from 'h3'
import { addClinicTime, clinicDateTime } from './clinic-time'

export type ClinicDateRange = {
  /** Start of `from` in clinic time. */
  from?: Date
  /** Start of the day after `to` in clinic time (exclusive). */
  to?: Date
  /** The dates as given, for labels and file names. */
  fromDate: string | null
  toDate: string | null
}

function parseDay(value: unknown): Date | undefined {
  if (value === undefined || value === '') return undefined
  const start = typeof value === 'string' ? clinicDateTime(value, '00:00') : new Date(NaN)
  if (Number.isNaN(start.getTime())) {
    throw createError({ statusCode: 400, statusMessage: 'Dates must be YYYY-MM-DD' })
  }
  return start
}

/** Optional inclusive `from` / `to` query params ("YYYY-MM-DD", clinic calendar). */
export function parseClinicDateRange(query: { from?: unknown; to?: unknown }): ClinicDateRange {
  const from = parseDay(query.from)
  const toStart = parseDay(query.to)
  const to = toStart ? addClinicTime(toStart, { days: 1 }) : undefined
  if (from && to && from >= to) {
    throw createError({ statusCode: 400, statusMessage: '`from` must be on or before `to`' })
  }
  return {
    from,
    to,
    fromDate: from ? String(query.from) : null,
    toDate: to ? String(query.to) : null,
  }
}
