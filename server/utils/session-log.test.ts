import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { PrismaClient } from '../../prisma/generated/client'
import { createTestPrisma, seedSession } from '../test-helpers/test-db'
import {
  countedMinutesFor,
  currentRows,
  nextSessionLogEvent,
  recordSessionLog,
  recordSessionLogForAppointments,
  type SessionLogState,
} from './session-log'

const signed: SessionLogState = {
  appointmentId: 'appt-1',
  clinicianUserId: 'clinician-1',
  sessionStart: new Date('2026-11-02T15:00:00.000Z'),
  sessionEnd: new Date('2026-11-02T16:00:00.000Z'),
  durationMinutes: 60,
  countedMinutes: 60,
  attendanceStatus: 'show',
  noteStatus: 'CLINICIAN_SIGNED',
  noteKind: 'PROGRESS',
}

describe('countedMinutesFor', () => {
  it('counts a signed `show`', () => {
    expect(countedMinutesFor(signed)).toBe(60)
  })

  it('counts nothing for a draft, even with attendance `show`', () => {
    expect(countedMinutesFor({ ...signed, noteStatus: 'DRAFT' })).toBe(0)
  })

  it.each(['no-show', 'canceled', 'late-canceled', 'clinician-canceled'])(
    'counts nothing for %s',
    (attendanceStatus) => {
      expect(countedMinutesFor({ ...signed, attendanceStatus })).toBe(0)
    }
  )
})

describe('nextSessionLogEvent', () => {
  it('writes SIGNED for the first signature', () => {
    expect(nextSessionLogEvent(null, signed)).toBe('SIGNED')
  })

  it('writes nothing for a draft with no history', () => {
    expect(nextSessionLogEvent(null, { ...signed, noteStatus: 'DRAFT' })).toBeNull()
  })

  it('writes nothing when nothing changed', () => {
    expect(nextSessionLogEvent(signed, { ...signed })).toBeNull()
  })

  it('writes APPROVED when only the status moves to FULLY_APPROVED', () => {
    expect(nextSessionLogEvent(signed, { ...signed, noteStatus: 'FULLY_APPROVED' })).toBe(
      'APPROVED'
    )
  })

  it('writes CORRECTED when attendance changes', () => {
    const noShow = { ...signed, attendanceStatus: 'no-show', countedMinutes: 0 }
    expect(nextSessionLogEvent(signed, noShow)).toBe('CORRECTED')
  })

  it('writes CORRECTED when an approved note goes back to clinician-signed', () => {
    const approved = { ...signed, noteStatus: 'FULLY_APPROVED' as const }
    expect(nextSessionLogEvent(approved, signed)).toBe('CORRECTED')
  })

  it('writes UNSIGNED when a signed note goes back to draft', () => {
    const draft = { ...signed, noteStatus: 'DRAFT' as const, countedMinutes: 0 }
    expect(nextSessionLogEvent(signed, draft)).toBe('UNSIGNED')
  })

  it('writes nothing for edits while unsigned, then SIGNED on re-sign', () => {
    const unsigned = { ...signed, noteStatus: 'DRAFT' as const, countedMinutes: 0 }
    expect(nextSessionLogEvent(unsigned, { ...unsigned, attendanceStatus: 'no-show' })).toBeNull()
    expect(nextSessionLogEvent(unsigned, signed)).toBe('SIGNED')
  })
})

describe('currentRows', () => {
  it('keeps only rows that nothing supersedes', () => {
    const rows = [
      { id: 'a', supersedesId: null },
      { id: 'b', supersedesId: 'a' },
      { id: 'c', supersedesId: null },
    ]
    expect(currentRows(rows).map((r) => r.id)).toEqual(['b', 'c'])
  })
})

describe('recordSessionLog on a real database', () => {
  const prisma: PrismaClient = createTestPrisma()
  let seeded: Awaited<ReturnType<typeof seedSession>>
  let n = 0

  async function sign(data: { attendanceStatus?: string } = {}) {
    await prisma.sessionNote.update({
      where: { id: seeded.note.id },
      data: {
        status: 'CLINICIAN_SIGNED',
        clinicianSignedById: seeded.clinician.id,
        clinicianSignedAt: new Date(),
        ...data,
      },
    })
  }

  function log() {
    return recordSessionLog(prisma, {
      sessionNoteId: seeded.note.id,
      recordedById: seeded.clinician.id,
    })
  }

  /** The note's rows in chain order (first row, then whatever supersedes it, ...). */
  async function rows() {
    const all = await prisma.sessionLog.findMany({ where: { sessionNoteId: seeded.note.id } })
    const ordered: typeof all = []
    let next = all.find((row) => row.supersedesId === null)
    while (next) {
      ordered.push(next)
      const id: string = next.id
      next = all.find((row) => row.supersedesId === id)
    }
    return ordered
  }

  beforeEach(async () => {
    n += 1
    seeded = await seedSession(prisma, { suffix: String(n) })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('writes nothing for the placeholder draft note', async () => {
    expect(await log()).toEqual({ written: false })
    expect(await rows()).toHaveLength(0)
  })

  it('writes one SIGNED row with the scheduled minutes and the signer', async () => {
    await sign()
    expect(await log()).toMatchObject({ written: true, event: 'SIGNED' })

    const [row] = await rows()
    expect(row).toMatchObject({
      event: 'SIGNED',
      clinicianUserId: seeded.clinician.id,
      clinicianName: 'Dana Lee',
      clientUserId: seeded.clientUser.id,
      appointmentId: seeded.appointment.id,
      durationMinutes: 60,
      countedMinutes: 60,
      supersedesId: null,
    })
  })

  it('appends a correction for show -> no-show and leaves the first row untouched', async () => {
    await sign()
    await log()
    await sign({ attendanceStatus: 'no-show' })
    await recordSessionLog(prisma, {
      sessionNoteId: seeded.note.id,
      recordedById: seeded.clinician.id,
      reason: 'Client did not join',
    })

    const [first, second] = await rows()
    expect(first).toMatchObject({ event: 'SIGNED', countedMinutes: 60 })
    expect(second).toMatchObject({
      event: 'CORRECTED',
      countedMinutes: 0,
      supersedesId: first!.id,
      reason: 'Client did not join',
    })
  })

  it('writes nothing when the note is saved again with no change', async () => {
    await sign()
    await log()
    expect(await log()).toEqual({ written: false })
    expect(await rows()).toHaveLength(1)
  })

  it('keeps the logged times after the appointment is deleted', async () => {
    await sign()
    await log()
    await prisma.appointment.delete({ where: { id: seeded.appointment.id } })

    expect(await log()).toEqual({ written: false })
    await prisma.sessionNote.update({
      where: { id: seeded.note.id },
      data: { status: 'FULLY_APPROVED' },
    })
    expect(await log()).toMatchObject({ written: true, event: 'APPROVED' })
    const latest = (await rows()).at(-1)
    expect(latest).toMatchObject({ appointmentId: seeded.appointment.id, durationMinutes: 60 })
  })

  it('rolls back the note change when the log write fails in the same transaction', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.sessionNote.update({
          where: { id: seeded.note.id },
          data: { status: 'CLINICIAN_SIGNED', clinicianSignedById: seeded.clinician.id },
        })
        await recordSessionLog(tx, { sessionNoteId: seeded.note.id, recordedById: 'x' })
        throw new Error('simulated failure after the log write')
      })
    ).rejects.toThrow('simulated failure')

    const note = await prisma.sessionNote.findUnique({ where: { id: seeded.note.id } })
    expect(note?.status).toBe('DRAFT')
    expect(await rows()).toHaveLength(0)
  })

  it('corrects the logged minutes when a signed session is moved', async () => {
    await sign()
    await log()
    await prisma.appointment.update({
      where: { id: seeded.appointment.id },
      data: { endTime: new Date('2026-11-02T15:45:00.000Z') },
    })
    await recordSessionLogForAppointments(prisma, {
      appointmentIds: [seeded.appointment.id],
      recordedById: seeded.clinician.id,
      reason: 'Appointment time changed',
    })

    const latest = (await rows()).at(-1)
    expect(latest).toMatchObject({
      event: 'CORRECTED',
      durationMinutes: 45,
      countedMinutes: 45,
      reason: 'Appointment time changed',
    })
  })
})
