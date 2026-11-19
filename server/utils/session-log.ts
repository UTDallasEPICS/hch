import type { PrismaClient } from '../../prisma/generated/client'
import type {
  SessionLogEvent,
  SessionNoteKind,
  SessionNoteStatus,
} from '../../prisma/generated/enums'
import { formatStoredUserNameForDisplay } from './name'

/**
 * Per-clinician session log (REQ-F-11). Rules: docs/session-log-metrics.md.
 *
 * Call `recordSessionLog` after any change to a session note, inside the same
 * transaction. It compares the note with its latest log row and appends a new row
 * only when something in the log changed. Rows are never updated or deleted.
 */

type LogDb = Pick<PrismaClient, 'sessionNote' | 'sessionLog'>

/** The part of a log row that decides whether a new row is needed. */
export type SessionLogState = {
  appointmentId: string | null
  clinicianUserId: string
  sessionStart: Date
  sessionEnd: Date
  durationMinutes: number
  countedMinutes: number
  attendanceStatus: string
  noteStatus: SessionNoteStatus
  noteKind: SessionNoteKind
}

type ChainRow = { id: string; supersedesId: string | null }

export function isSignedNoteStatus(status: SessionNoteStatus): boolean {
  return status === 'CLINICIAN_SIGNED' || status === 'FULLY_APPROVED'
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000))
}

/** A session counts when its note is signed and the client attended. */
export function countedMinutesFor(
  state: Pick<SessionLogState, 'attendanceStatus' | 'noteStatus' | 'durationMinutes'>
): number {
  return isSignedNoteStatus(state.noteStatus) && state.attendanceStatus === 'show'
    ? state.durationMinutes
    : 0
}

/** Rows that no other row supersedes: the current state of each session. */
export function currentRows<T extends ChainRow>(rows: T[]): T[] {
  const superseded = new Set(rows.map((row) => row.supersedesId).filter(Boolean))
  return rows.filter((row) => !superseded.has(row.id))
}

function sameState(a: SessionLogState, b: SessionLogState): boolean {
  return (
    a.appointmentId === b.appointmentId &&
    a.clinicianUserId === b.clinicianUserId &&
    a.sessionStart.getTime() === b.sessionStart.getTime() &&
    a.sessionEnd.getTime() === b.sessionEnd.getTime() &&
    a.durationMinutes === b.durationMinutes &&
    a.countedMinutes === b.countedMinutes &&
    a.attendanceStatus === b.attendanceStatus &&
    a.noteStatus === b.noteStatus &&
    a.noteKind === b.noteKind
  )
}

/** Which event moving from `previous` to `next` is, or null when no row should be written. */
export function nextSessionLogEvent(
  previous: SessionLogState | null,
  next: SessionLogState
): SessionLogEvent | null {
  const nowSigned = isSignedNoteStatus(next.noteStatus)
  if (!previous) return nowSigned ? 'SIGNED' : null

  const wasSigned = isSignedNoteStatus(previous.noteStatus)
  if (!wasSigned && !nowSigned) return null // drafts never write rows
  if (sameState(previous, next)) return null
  if (wasSigned && !nowSigned) return 'UNSIGNED'
  if (!wasSigned && nowSigned) return 'SIGNED'

  const onlyApproved =
    previous.noteStatus === 'CLINICIAN_SIGNED' &&
    next.noteStatus === 'FULLY_APPROVED' &&
    sameState({ ...previous, noteStatus: next.noteStatus }, next)
  return onlyApproved ? 'APPROVED' : 'CORRECTED'
}

export type SessionLogSkipReason = 'NOTE_NOT_FOUND' | 'NO_SIGNER' | 'NO_SESSION_TIME'

export type RecordSessionLogResult =
  | { written: true; id: string; event: SessionLogEvent }
  | { written: false; skipped?: SessionLogSkipReason }

export async function recordSessionLog(
  db: LogDb,
  input: {
    sessionNoteId: string
    recordedById: string
    reason?: string | null
    /** Event for a note's first row. Only the backfill (#215) sets this. */
    firstEvent?: 'BACKFILL'
  }
): Promise<RecordSessionLogResult> {
  const note = await db.sessionNote.findUnique({
    where: { id: input.sessionNoteId },
    select: {
      id: true,
      status: true,
      kind: true,
      attendanceStatus: true,
      clinicianSignedById: true,
      clinicianSigner: { select: { name: true, email: true } },
      appointment: { select: { id: true, startTime: true, endTime: true } },
      client: { select: { userId: true } },
    },
  })
  if (!note) return { written: false, skipped: 'NOTE_NOT_FOUND' }

  const chain = await db.sessionLog.findMany({ where: { sessionNoteId: note.id } })
  const previous = currentRows(chain)[0] ?? null

  // Drafts never write rows, so an unsigned note with no history is simply not logged yet.
  if (!previous && !isSignedNoteStatus(note.status)) return { written: false }

  // When the appointment is gone, keep the times that were already logged.
  const session = note.appointment
    ? {
        appointmentId: note.appointment.id,
        sessionStart: note.appointment.startTime,
        sessionEnd: note.appointment.endTime,
      }
    : previous
      ? {
          appointmentId: previous.appointmentId,
          sessionStart: previous.sessionStart,
          sessionEnd: previous.sessionEnd,
        }
      : null
  if (!session) return { written: false, skipped: 'NO_SESSION_TIME' }

  const clinicianUserId = note.clinicianSignedById ?? previous?.clinicianUserId
  if (!clinicianUserId) return { written: false, skipped: 'NO_SIGNER' }
  const clinicianName =
    note.clinicianSignedById && note.clinicianSigner
      ? formatStoredUserNameForDisplay(note.clinicianSigner.name) || note.clinicianSigner.email
      : (previous?.clinicianName ?? '')

  const durationMinutes = minutesBetween(session.sessionStart, session.sessionEnd)
  const base = {
    ...session,
    clinicianUserId,
    durationMinutes,
    attendanceStatus: note.attendanceStatus ?? '',
    noteStatus: note.status,
    noteKind: note.kind,
  }
  const next: SessionLogState = { ...base, countedMinutes: countedMinutesFor(base) }

  const event = previous
    ? nextSessionLogEvent(previous, next)
    : (input.firstEvent ?? nextSessionLogEvent(null, next))
  if (!event) return { written: false }

  const row = await db.sessionLog.create({
    data: {
      ...next,
      event,
      sessionNoteId: note.id,
      clinicianName,
      clientUserId: note.client.userId,
      supersedesId: previous?.id ?? null,
      reason: input.reason?.trim() || null,
      recordedById: input.recordedById,
    },
    select: { id: true },
  })
  return { written: true, id: row.id, event }
}

/**
 * After appointment times change: re-check every signed note on those appointments.
 * Notes whose logged times already match write nothing.
 */
export async function recordSessionLogForAppointments(
  db: LogDb,
  input: { appointmentIds: string[]; recordedById: string; reason: string }
): Promise<void> {
  if (input.appointmentIds.length === 0) return
  const notes = await db.sessionNote.findMany({
    where: {
      appointmentId: { in: input.appointmentIds },
      status: { in: ['CLINICIAN_SIGNED', 'FULLY_APPROVED'] },
    },
    select: { id: true },
  })
  for (const note of notes) {
    await recordSessionLog(db, {
      sessionNoteId: note.id,
      recordedById: input.recordedById,
      reason: input.reason,
    })
  }
}
