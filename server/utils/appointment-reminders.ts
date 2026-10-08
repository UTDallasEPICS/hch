import { prisma } from './prisma'
import { emailUsers, notifyUser, resolveAppointmentRecipients } from './notifications'

/** How long before the session the reminder goes out (#118 suggests 24h). */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000

/** Same display format as the #122 booking/reschedule messages. */
function formatWhen(d: Date): string {
  return d.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Chicago',
  })
}

/**
 * Send reminders for appointments starting in the next 24h that haven't
 * been reminded yet. Safe to call over and over: each appointment is
 * "claimed" by setting remindedAt before anything is sent.
 * Returns how many appointments were reminded.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const windowEnd = new Date(now.getTime() + REMINDER_LEAD_MS)

  const due = await prisma.appointment.findMany({
    where: {
      remindedAt: null,
      startTime: { gt: now, lte: windowEnd },
    },
    select: { id: true, clientId: true, startTime: true },
    orderBy: { startTime: 'asc' },
  })

  let sent = 0
  for (const appt of due) {
    // Claim it. Only works if remindedAt is still null.
    const claim = await prisma.appointment.updateMany({
      where: { id: appt.id, remindedAt: null },
      data: { remindedAt: now },
    })
    if (claim.count === 0) continue // already sent by another run

    try {
      const recipients = await resolveAppointmentRecipients(appt.clientId)
      const title = 'Session reminder'
      const message = `Reminder: you have a session on ${formatWhen(appt.startTime)}.`

      for (const userId of recipients) {
        await notifyUser({
          userId,
          type: 'APPOINTMENT_REMINDER',
          title,
          message,
          appointmentId: appt.id,
        })
      }
      await emailUsers(recipients, {
        subject: title,
        intro: message,
        closing: 'Sign in to the portal and open Calendar for details.',
      })
      sent++
    } catch (err) {
      // Log the id only, never names or times (those are PHI).
      console.error(`[reminders] failed for appointment ${appt.id}`, err)
    }
  }

  return sent
}


