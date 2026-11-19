import { CLINIC_TIME_ZONE, clinicMonthKey } from './clinic-time'
import { currentRows } from './session-log'

/**
 * Admin metrics for REQ-F-11, computed from session log rows.
 * Definitions: docs/session-log-metrics.md §3. Pure: no database access.
 */

export type MetricsLogRow = {
  id: string
  supersedesId: string | null
  clientUserId: string
  sessionStart: Date
  countedMinutes: number
}

export type MonthMetrics = {
  /** "2026-11" in clinic time. */
  month: string
  /** "Nov 2026". */
  label: string
  hours: number
  clientsServed: number
  /** True for the current month, which is still in progress. */
  partial: boolean
}

export type OrgMetrics = {
  timeZone: string
  totals: {
    clientsServed: number
    activeClients: number
    cumulativeHours: number
    sessions: number
  }
  /** The last 12 months, oldest first. The last entry is the current (partial) month. */
  months: MonthMetrics[]
  lastFullMonth: MonthMetrics & {
    hoursGrowthPct: number | null
    clientsServedGrowthPct: number | null
  }
}

export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

/** Percent change, 1 decimal. Null when there is nothing to compare against. */
export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function shiftMonth(key: string, delta: number): string {
  const [year = 0, month = 1] = key.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year = 0, month = 1] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type Bucket = { minutes: number; clients: Set<string> }

export function buildOrgMetrics(input: {
  /** Every session log row; superseded rows are dropped here. */
  rows: MetricsLogRow[]
  activeClients: number
  now: Date
  /** Optional window for the totals only. `to` is exclusive. */
  range?: { from?: Date; to?: Date }
  timeZone?: string
}): OrgMetrics {
  const timeZone = input.timeZone ?? CLINIC_TIME_ZONE
  const counted = currentRows(input.rows).filter((row) => row.countedMinutes > 0)

  const inRange = counted.filter(
    (row) =>
      (!input.range?.from || row.sessionStart >= input.range.from) &&
      (!input.range?.to || row.sessionStart < input.range.to)
  )
  const totalMinutes = inRange.reduce((sum, row) => sum + row.countedMinutes, 0)

  const buckets = new Map<string, Bucket>()
  for (const row of counted) {
    const key = clinicMonthKey(row.sessionStart, timeZone)
    const bucket = buckets.get(key) ?? { minutes: 0, clients: new Set<string>() }
    bucket.minutes += row.countedMinutes
    bucket.clients.add(row.clientUserId)
    buckets.set(key, bucket)
  }

  const thisMonth = clinicMonthKey(input.now, timeZone)
  const monthFor = (key: string): MonthMetrics => {
    const bucket = buckets.get(key)
    return {
      month: key,
      label: monthLabel(key),
      hours: minutesToHours(bucket?.minutes ?? 0),
      clientsServed: bucket?.clients.size ?? 0,
      partial: key === thisMonth,
    }
  }

  const months = Array.from({ length: 12 }, (_, i) => monthFor(shiftMonth(thisMonth, i - 11)))

  // Growth compares the last full month with the one before, using exact minutes.
  const lastKey = shiftMonth(thisMonth, -1)
  const priorKey = shiftMonth(thisMonth, -2)
  const last = buckets.get(lastKey)
  const prior = buckets.get(priorKey)

  return {
    timeZone,
    totals: {
      clientsServed: new Set(inRange.map((row) => row.clientUserId)).size,
      activeClients: input.activeClients,
      cumulativeHours: minutesToHours(totalMinutes),
      sessions: inRange.length,
    },
    months,
    lastFullMonth: {
      ...monthFor(lastKey),
      hoursGrowthPct: growthPct(last?.minutes ?? 0, prior?.minutes ?? 0),
      clientsServedGrowthPct: growthPct(last?.clients.size ?? 0, prior?.clients.size ?? 0),
    },
  }
}
