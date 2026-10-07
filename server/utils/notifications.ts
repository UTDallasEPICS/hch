import { prisma } from './prisma'
import type { NotificationType } from '../../prisma/generated/enums'
import { getAssignedClinicianUserId } from './clinician-access'

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
export async function resolveAppointmentRecipients(
  clientUserId: string
): Promise<string[]> {
  const clinicianId = await getAssignedClinicianUserId(clientUserId)
  const staffIds = clinicianId ? [clinicianId] : await getAdminUserIds()
  return [...new Set([clientUserId, ...staffIds])]
}
