import { describe, it, expect, vi, beforeEach } from 'vitest'

// The real prisma client needs a live DATABASE_URL, so the db and the
// notification helpers are mocked. These tests check the reminder logic only.
vi.mock('./prisma', () => ({
  prisma: {
    appointment: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('./notifications', () => ({
  notifyUser: vi.fn(),
  emailUsers: vi.fn(),
  resolveAppointmentRecipients: vi.fn(),
}))

import { prisma } from './prisma'
import { emailUsers, notifyUser, resolveAppointmentRecipients } from './notifications'
import { sendDueReminders, REMINDER_LEAD_MS } from './appointment-reminders'

type Mock = ReturnType<typeof vi.fn>
const findMany = prisma.appointment.findMany as unknown as Mock
const updateMany = prisma.appointment.updateMany as unknown as Mock
const notify = notifyUser as unknown as Mock
const email = emailUsers as unknown as Mock
const recipients = resolveAppointmentRecipients as unknown as Mock

const NOW = new Date('2026-10-15T12:00:00Z')

function appt(id: string, hoursFromNow: number, clientId = 'client-1') {
  return { id, clientId, startTime: new Date(NOW.getTime() + hoursFromNow * 3600_000) }
}

beforeEach(() => {
  vi.clearAllMocks()
  updateMany.mockResolvedValue({ count: 1 })
  recipients.mockResolvedValue(['client-1', 'clinician-1'])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('sendDueReminders', () => {
  it('only looks for un-reminded appointments starting in the next 24h', async () => {
    findMany.mockResolvedValue([])
    await sendDueReminders(NOW)

    const where = findMany.mock.calls[0][0].where
    expect(where.remindedAt).toBeNull()
    expect(where.startTime.gt).toEqual(NOW)
    expect(where.startTime.lte).toEqual(new Date(NOW.getTime() + REMINDER_LEAD_MS))
  })

  it('reminds the client and the assigned clinician, in-app and by email', async () => {
    findMany.mockResolvedValue([appt('a1', 20)])

    const sent = await sendDueReminders(NOW)

    expect(sent).toBe(1)
    expect(recipients).toHaveBeenCalledWith('client-1')
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls.map((c) => c[0].userId)).toEqual(['client-1', 'clinician-1'])
    expect(notify.mock.calls[0][0]).toMatchObject({
      type: 'APPOINTMENT_REMINDER',
      appointmentId: 'a1',
    })
    expect(email).toHaveBeenCalledWith(['client-1', 'clinician-1'], expect.any(Object))
  })

  it('claims each appointment before sending, so it is only reminded once', async () => {
    findMany.mockResolvedValue([appt('a1', 20)])
    await sendDueReminders(NOW)

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'a1', remindedAt: null },
      data: { remindedAt: NOW },
    })
    const claimOrder = updateMany.mock.invocationCallOrder[0]
    expect(claimOrder).toBeLessThan(notify.mock.invocationCallOrder[0])
  })

  it('skips an appointment another check already claimed (no duplicates)', async () => {
    findMany.mockResolvedValue([appt('a1', 20)])
    updateMany.mockResolvedValue({ count: 0 })

    const sent = await sendDueReminders(NOW)

    expect(sent).toBe(0)
    expect(notify).not.toHaveBeenCalled()
    expect(email).not.toHaveBeenCalled()
  })

  it('sends one reminder per occurrence of a recurring series', async () => {
    findMany.mockResolvedValue([appt('s1', 2), appt('s2', 23)])

    const sent = await sendDueReminders(NOW)

    expect(sent).toBe(2)
    expect(notify.mock.calls.map((c) => c[0].appointmentId)).toEqual(['s1', 's1', 's2', 's2'])
  })

  it('keeps going when one appointment fails, and logs no PHI', async () => {
    findMany.mockResolvedValue([appt('bad', 5), appt('good', 6)])
    recipients.mockRejectedValueOnce(new Error('boom'))

    const sent = await sendDueReminders(NOW)

    expect(sent).toBe(1)
    expect(notify.mock.calls.every((c) => c[0].appointmentId === 'good')).toBe(true)
    const logged = (console.error as unknown as Mock).mock.calls[0][0] as string
    expect(logged).toContain('bad')
    expect(logged).not.toContain('client-1')
  })
})
