import { createError, type H3Event } from 'h3'
import type { PrismaClient } from '../../prisma/generated/client'
import type { SessionLogEvent, SessionNoteStatus } from '../../prisma/generated/enums'
import { CLINIC_TIME_ZONE, formatClinicClock, formatClinicDate } from './clinic-time'
import type { ClinicDateRange } from './date-range'
import { requireStaff } from './guard'
import { formatStoredUserNameForDisplay } from './name'
import { minutesToHours } from './org-metrics'

/**
 * One clinician's session log for the in-app view and the CSV export (#218).
 * Rules: docs/session-log-metrics.md §5. No client information leaves this module:
 * no client id, name, session name, note text, or correction reason.
 */

export type SessionLogReportRow = {
  id: string
  event: SessionLogEvent
  /** Clinic calendar date, "2026-11-02". */
  sessionDate: string
  /** Clinic wall-clock times, "09:00". */
  startTime: string
  endTime: string
  durationMinutes: number
  countedMinutes: number
  attendanceStatus: string
  noteStatus: SessionNoteStatus
  supersedesId: string | null
  /** False when a later row replaced this one. Only current rows count toward totals. */
  current: boolean
  recordedAt: string
}

export type SessionLogReport = {
  clinician: { id: string; name: string }
  timeZone: string
  range: { from: string | null; to: string | null }
  rows: SessionLogReportRow[]
  totals: { countedHours: number; countedMinutes: number; countedSessions: number }
}

/** Admins can see any clinician's log; a clinician only their own. */
export function assertCanViewSessionLog(event: H3Event, clinicianUserId: string) {
  const user = requireStaff(event)
  if (event.context.isAdmin || user.id === clinicianUserId) return user
  throw createError({ statusCode: 403, statusMessage: "Forbidden: another clinician's log" })
}

type ReportDb = Pick<PrismaClient, 'user' | 'sessionLog'>

export async function loadSessionLogReport(
  db: ReportDb,
  clinicianUserId: string,
  range: ClinicDateRange
): Promise<SessionLogReport> {
  const clinician = await db.user.findUnique({
    where: { id: clinicianUserId },
    select: { id: true, name: true, email: true, role: true },
  })
  if (!clinician || clinician.role === 'CLIENT') {
    throw createError({ statusCode: 404, statusMessage: 'Clinician not found' })
  }

  const rows = await db.sessionLog.findMany({
    where: {
      clinicianUserId,
      sessionStart: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) },
    },
    orderBy: [{ sessionStart: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      event: true,
      sessionNoteId: true,
      sessionStart: true,
      sessionEnd: true,
      durationMinutes: true,
      countedMinutes: true,
      attendanceStatus: true,
      noteStatus: true,
      supersedesId: true,
      createdAt: true,
    },
  })

  // A row can be replaced by a later row for another clinician (another signer) or
  // outside the range (a moved session), so check the whole chain of each note.
  const noteIds = [...new Set(rows.map((row) => row.sessionNoteId))]
  const replacements = noteIds.length
    ? await db.sessionLog.findMany({
        where: { sessionNoteId: { in: noteIds }, supersedesId: { not: null } },
        select: { supersedesId: true },
      })
    : []
  const superseded = new Set(replacements.map((row) => row.supersedesId))

  const reportRows: SessionLogReportRow[] = rows.map((row) => ({
    id: row.id,
    event: row.event,
    sessionDate: formatClinicDate(row.sessionStart),
    startTime: formatClinicClock(row.sessionStart),
    endTime: formatClinicClock(row.sessionEnd),
    durationMinutes: row.durationMinutes,
    countedMinutes: row.countedMinutes,
    attendanceStatus: row.attendanceStatus,
    noteStatus: row.noteStatus,
    supersedesId: row.supersedesId,
    current: !superseded.has(row.id),
    recordedAt: row.createdAt.toISOString(),
  }))

  const counted = reportRows.filter((row) => row.current && row.countedMinutes > 0)
  const countedMinutes = counted.reduce((sum, row) => sum + row.countedMinutes, 0)

  return {
    clinician: {
      id: clinician.id,
      name: formatStoredUserNameForDisplay(clinician.name) || clinician.email,
    },
    timeZone: CLINIC_TIME_ZONE,
    range: { from: range.fromDate, to: range.toDate },
    rows: reportRows,
    totals: {
      countedHours: minutesToHours(countedMinutes),
      countedMinutes,
      countedSessions: counted.length,
    },
  }
}

/** Quote when needed, and stop spreadsheet apps from running a cell as a formula. */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const CSV_COLUMNS = [
  'Date',
  'Start',
  'End',
  'Scheduled minutes',
  'Counted minutes',
  'Attendance',
  'Note status',
  'Event',
  'Current',
  'Entry ID',
  'Supersedes ID',
] as const

export function buildSessionLogCsv(
  report: SessionLogReport,
  meta: { exportedAt: Date; exportedBy: string }
): string {
  const { from, to } = report.range
  const rangeLabel = from || to ? `${from ?? 'start'} to ${to ?? 'today'}` : 'All dates'
  const lines: (string | number | null)[][] = [
    ['Session log'],
    ['Clinician', report.clinician.name],
    ['Date range', rangeLabel],
    ['Total counted hours', report.totals.countedHours],
    ['Counted sessions', report.totals.countedSessions],
    ['Time zone', report.timeZone],
    [
      'Exported at',
      `${formatClinicDate(meta.exportedAt)} ${formatClinicClock(meta.exportedAt)} (clinic time)`,
    ],
    ['Exported by', meta.exportedBy],
    ['Note', 'Only rows marked Current count toward the totals. Earlier rows are kept as history.'],
    [],
    [...CSV_COLUMNS],
    ...report.rows.map((row) => [
      row.sessionDate,
      row.startTime,
      row.endTime,
      row.durationMinutes,
      row.countedMinutes,
      row.attendanceStatus,
      row.noteStatus,
      row.event,
      row.current ? 'yes' : 'no',
      row.id,
      row.supersedesId,
    ]),
  ]
  return lines.map((line) => line.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function sessionLogCsvFileName(report: SessionLogReport): string {
  const slug = report.clinician.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const range = [report.range.from, report.range.to].filter(Boolean).join('-to-')
  return `session-log-${slug || 'clinician'}${range ? `-${range}` : ''}.csv`
}
