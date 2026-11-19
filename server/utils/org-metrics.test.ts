import { describe, expect, it } from 'vitest'
import { clinicMonthKey } from './clinic-time'
import { buildOrgMetrics, growthPct, type MetricsLogRow } from './org-metrics'

const TZ = 'America/Chicago'
const NOW = new Date('2026-11-19T18:00:00.000Z')

function row(
  id: string,
  clientUserId: string,
  sessionStart: string,
  countedMinutes: number,
  supersedesId: string | null = null
): MetricsLogRow {
  return { id, supersedesId, clientUserId, sessionStart: new Date(sessionStart), countedMinutes }
}

const rows: MetricsLogRow[] = [
  row('sep', 'client-A', '2026-09-10T15:00:00.000Z', 60),
  row('oct-first', 'client-A', '2026-10-05T15:00:00.000Z', 60),
  row('oct-corrected', 'client-A', '2026-10-05T15:00:00.000Z', 45, 'oct-first'),
  // 11:30 PM on Oct 31 in Chicago, which is already Nov 1 in UTC.
  row('oct-late', 'client-B', '2026-11-01T04:30:00.000Z', 60),
  row('oct-no-show', 'client-C', '2026-10-20T15:00:00.000Z', 0),
  row('nov', 'client-A', '2026-11-10T16:00:00.000Z', 50),
]

describe('clinicMonthKey', () => {
  it('uses the clinic calendar, not UTC', () => {
    expect(clinicMonthKey(new Date('2026-11-01T04:30:00.000Z'), TZ)).toBe('2026-10')
    expect(clinicMonthKey(new Date('2026-11-01T05:30:00.000Z'), TZ)).toBe('2026-11')
  })
})

describe('growthPct', () => {
  it('is the percent change with 1 decimal', () => {
    expect(growthPct(105, 60)).toBe(75)
    expect(growthPct(2, 3)).toBe(-33.3)
  })

  it('is null when the previous month is 0, not Infinity', () => {
    expect(growthPct(5, 0)).toBeNull()
  })
})

describe('buildOrgMetrics', () => {
  const metrics = buildOrgMetrics({ rows, activeClients: 7, now: NOW, timeZone: TZ })

  it('totals only current rows, so corrections are not double counted', () => {
    // 60 (Sep) + 45 (corrected Oct) + 60 (late Oct) + 50 (Nov) = 215 min
    expect(metrics.totals).toEqual({
      clientsServed: 2,
      activeClients: 7,
      cumulativeHours: 3.6,
      sessions: 4,
    })
  })

  it('does not count a no-show client as served', () => {
    const oct = metrics.months.find((m) => m.month === '2026-10')
    expect(oct).toMatchObject({ hours: 1.8, clientsServed: 2 })
  })

  it('returns the last 12 months, oldest first, with the current month marked partial', () => {
    expect(metrics.months).toHaveLength(12)
    expect(metrics.months[0]).toMatchObject({ month: '2025-12', label: 'Dec 2025', hours: 0 })
    expect(metrics.months.at(-1)).toMatchObject({ month: '2026-11', hours: 0.8, partial: true })
    expect(metrics.months.filter((m) => m.partial)).toHaveLength(1)
  })

  it('compares the last full month with the one before', () => {
    expect(metrics.lastFullMonth).toMatchObject({
      month: '2026-10',
      label: 'Oct 2026',
      hours: 1.8,
      clientsServed: 2,
      hoursGrowthPct: 75, // 105 min vs 60 min
      clientsServedGrowthPct: 100, // 2 clients vs 1
      partial: false,
    })
  })

  it('reports null growth when the month before had nothing', () => {
    const onlyOct = rows.filter((r) => r.id !== 'sep')
    const result = buildOrgMetrics({ rows: onlyOct, activeClients: 0, now: NOW, timeZone: TZ })
    expect(result.lastFullMonth.hoursGrowthPct).toBeNull()
    expect(result.lastFullMonth.clientsServedGrowthPct).toBeNull()
  })

  it('limits the totals, not the monthly series, to a date range', () => {
    const result = buildOrgMetrics({
      rows,
      activeClients: 7,
      now: NOW,
      timeZone: TZ,
      range: {
        from: new Date('2026-10-01T05:00:00.000Z'),
        to: new Date('2026-11-01T05:00:00.000Z'),
      },
    })
    expect(result.totals).toMatchObject({ cumulativeHours: 1.8, clientsServed: 2, sessions: 2 })
    expect(result.months).toEqual(metrics.months)
  })
})
