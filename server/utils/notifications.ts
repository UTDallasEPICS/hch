import { prisma } from './prisma'
import type { NotificationType } from '../../prisma/generated/enums'
import { getAssignedClinicianUserId } from './clinician-access'
import { sendNotificationEmail, type EmailContent } from './email-template'

/**
 * Returns the user IDs of every user whose role is ADMIN, i.e. everyone who
 * should receive a system notification.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  return admins.map((u) => u.id)
}

export async function notifyAdmins(opts: {
  type: NotificationType
  title: string
  message: string
  sessionNoteId?: string | null
}): Promise<number> {
  const adminIds = await getAdminUserIds()
  if (!adminIds.length) return 0

  await prisma.notification.createMany({
    data: adminIds.map((userId) => ({
      userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      sessionNoteId: opts.sessionNoteId ?? null,
    })),
  })
  return adminIds.length
}

export async function notifyUser(opts: {
  userId: string
  type: NotificationType
  title: string
  message: string
  sessionNoteId?: string | null
  appointmentId?: string | null
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      sessionNoteId: opts.sessionNoteId ?? null,
      appointmentId: opts.appointmentId ?? null,
    },
  })
}

/**
 * Who should be notified about an appointment for this client.
 *
 * Rule: the client, plus their assigned clinician. If the client has no
 * assigned clinician, the client plus every admin instead. No one else.
 *
 * Uses the same clinician lookup as assertStaffCanAccessClient, so the people
 * notified always match the people allowed to see this client.
 *
 * Pass the client's USER id (Appointment.clientId / Client.userId).
 */
export async function resolveAppointmentRecipients(clientUserId: string): Promise<string[]> {
  const clinicianId = await getAssignedClinicianUserId(clientUserId)
  const staffIds = clinicianId ? [clinicianId] : await getAdminUserIds()
  return [...new Set([clientUserId, ...staffIds])]
}

export type EmailRecipient = { id: string; email: string; name: string; role: string }
export type EmailMessage = { subject: string } & EmailContent

/**
 * Email each user individually (never one shared "To:" line, so recipients
 * don't see each other's addresses).
 *
 * Pass one message for everyone, or a function that builds each person's
 * own version (e.g. different wording for the client vs. their clinician).
 *
 * If one address fails, it's logged and skipped so everyone else still gets theirs.
 */
export async function emailUsers(
  userIds: string[],
  email: EmailMessage | ((recipient: EmailRecipient) => EmailMessage)
): Promise<void> {
  if (!userIds.length) return
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, name: true, role: true },
  })
  for (const u of users) {
    const message = typeof email === 'function' ? email(u) : email
    try {
      await sendNotificationEmail({ to: u.email, ...message })
    } catch (err) {
      // Log the user id only, never the email address
      console.error(`[email] failed for user ${u.id}`, err)
    }
  }
}
