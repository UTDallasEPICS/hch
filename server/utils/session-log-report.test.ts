import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { createTestPrisma, seedSession } from '../test-helpers/test-db'
import { parseClinicDateRange } from './date-range'
import { recordSessionLog } from './session-log'
import {
  assertCanViewSessionLog,
  buildSessionLogCsv,
  csvCell,
  loadSessionLogReport,
  sessionLogCsvFileName,
  type SessionLogReport,
} from './session-log-report'

const prisma = createTestPrisma()
let dana = ''
let jordan = ''

async function signAndLog(noteId: string, clinicianId: string, data: Record<string, unknown> = {}) {
  await prisma.sessionNote.update({
    where: { id: noteId },
    data: { status: 'CLINICIAN_SIGNED', clinicianSignedById: clinicianId, ...data },
  })
  await recordSessionLog(prisma, { sessionNoteId: noteId, recordedById: clinicianId })
}

beforeAll(async () => {
  // Session 1: Dana signs it, then corrects it to a no-show.
  const one = await seedSession(prisma, { suffix: '1' })
  dana = one.clinician.id
  await signAndLog(one.note.id, dana)
  await signAndLog(one.note.id, dana, { attendanceStatus: 'no-show' })

  // Session 2: Dana signs it, then Jordan re-signs it. It now counts for Jordan only.
  const two = await seedSession(prisma, { suffix: '2' })
  jordan = two.clinician.id
  await signAndLog(two.note.id, dana)
  await signAndLog(two.note.id, jordan)

  // Session 3: Dana signs it. Counts.
  const three = await seedSession(prisma, { suffix: '3' })
  await signAndLog(three.note.id, dana)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('loadSessionLogReport', () => {
  it('keeps replaced rows as history but only counts current rows', async () => {
    const report = await loadSessionLogReport(prisma, dana, parseClinicDateRange({}))

    expect(report.clinician.name).toBe('Dana Lee')
    expect(report.rows).toHaveLength(4)
    expect(report.rows.filter((r) => r.current)).toHaveLength(2)
    // Only session 3 counts: session 1 became a no-show, session 2 moved to Jordan.
    expect(report.totals).toEqual({ countedHours: 1, countedMinutes: 60, countedSessions: 1 })
  })

  it("does not count a row that another clinician's re-sign replaced", async () => {
    const report = await loadSessionLogReport(prisma, jordan, parseClinicDateRange({}))
    expect(report.rows).toHaveLength(1)
    expect(report.totals.countedSessions).toBe(1)
  })

  it('filters by session date in clinic time', async () => {
    const report = await loadSessionLogReport(
      prisma,
      dana,
      parseClinicDateRange({ from: '2026-11-03', to: '2026-11-30' })
    )
    expect(report.rows).toEqual([])
    expect(report.totals.countedSessions).toBe(0)
  })

  it('returns 404 for a client id', async () => {
    await expect(
      loadSessionLogReport(prisma, 'client-1', parseClinicDateRange({}))
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('buildSessionLogCsv', () => {
  const meta = { exportedAt: new Date('2026-11-19T20:05:00.000Z'), exportedBy: 'Avery Admin' }

  it('has totals that match the rows marked Current, and no client details', async () => {
    const report = await loadSessionLogReport(prisma, dana, parseClinicDateRange({}))
    const csv = buildSessionLogCsv(report, meta)
    const lines = csv.trim().split('\r\n')

    expect(lines).toContain('Total counted hours,1')
    expect(lines).toContain('Exported at,2026-11-19 14:05 (clinic time)')
    const header = lines.indexOf(
      'Date,Start,End,Scheduled minutes,Counted minutes,Attendance,Note status,Event,Current,Entry ID,Supersedes ID'
    )
    const table = lines.slice(header + 1).map((line) => line.split(','))
    expect(table).toHaveLength(4)
    const counted = table.filter((cells) => cells[8] === 'yes').map((cells) => Number(cells[4]))
    expect(counted.reduce((a, b) => a + b, 0)).toBe(60)
    expect(table[0]?.slice(0, 3)).toEqual(['2026-11-02', '09:00', '10:00'])

    expect(csv).not.toMatch(/client-|sam|rivera|Sam_Rivera/i)
  })

  it('is just the header block for an empty range', () => {
    const empty: SessionLogReport = {
      clinician: { id: 'c', name: 'Dana Lee' },
      timeZone: 'America/Chicago',
      range: { from: '2030-01-01', to: '2030-01-31' },
      rows: [],
      totals: { countedHours: 0, countedMinutes: 0, countedSessions: 0 },
    }
    const lines = buildSessionLogCsv(empty, meta).trim().split('\r\n')
    expect(lines.at(-1)).toMatch(/^Date,Start,End/)
    expect(lines).toContain('Date range,2030-01-01 to 2030-01-31')
    expect(sessionLogCsvFileName(empty)).toBe('session-log-dana-lee-2030-01-01-to-2030-01-31.csv')
  })
})

describe('csvCell', () => {
  it('quotes commas and quotes', () => {
    expect(csvCell('Lee, Dana "DL"')).toBe('"Lee, Dana ""DL"""')
  })

  it('stops a cell from running as a spreadsheet formula', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('leaves numbers alone, including negatives', () => {
    expect(csvCell(-5)).toBe('-5')
  })
})

describe('assertCanViewSessionLog', () => {
  function event(id: string | null, role: 'ADMIN' | 'CLINICIAN' | 'CLIENT') {
    return {
      context: {
        user: id ? { id, role } : undefined,
        isAdmin: role === 'ADMIN',
        isClinician: role === 'CLINICIAN',
        isStaff: role !== 'CLIENT',
      },
    } as unknown as H3Event
  }

  it('lets an admin view any clinician', () => {
    expect(() => assertCanViewSessionLog(event('admin-1', 'ADMIN'), 'clinician-B')).not.toThrow()
  })

  it('lets a clinician view their own log', () => {
    expect(() =>
      assertCanViewSessionLog(event('clinician-A', 'CLINICIAN'), 'clinician-A')
    ).not.toThrow()
  })

  it("blocks a clinician from another clinician's log", () => {
    expect(() => assertCanViewSessionLog(event('clinician-A', 'CLINICIAN'), 'clinician-B')).toThrow(
      expect.objectContaining({ statusCode: 403 })
    )
  })

  it('blocks clients and signed-out users', () => {
    expect(() => assertCanViewSessionLog(event('client-1', 'CLIENT'), 'client-1')).toThrow(
      expect.objectContaining({ statusCode: 403 })
    )
    expect(() => assertCanViewSessionLog(event(null, 'CLIENT'), 'x')).toThrow(
      expect.objectContaining({ statusCode: 401 })
    )
  })
})
