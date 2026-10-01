import { H3Event, createError } from 'h3'
import { prisma } from './prisma'

/**
 * Returns the assigned clinician's user id for a client, or null if the client
 * is unassigned or doesn't exist. Single source of truth for "who is this
 * client's clinician", shared by access checks and notification recipients.
 *
 * Pass the client's USER id (Client.userId).
 */
export async function getAssignedClinicianUserId(
  clientUserId: string
): Promise<string | null> {
  const client = await prisma.client.findUnique({
    where: { userId: clientUserId },
    select: { clinicianUserId: true },
  })
  return client?.clinicianUserId ?? null
}

/**
 * Ensure the caller is allowed to act on the given client.
 * - Admins always pass.
 * - Clinicians pass only if they're assigned to the client (Client.clinicianUserId == user.id).
 * - Anyone else is rejected (403).
 *
 * Pass the client's USER id (the User.id stored on Client.userId), matching how
 * route params like /clients/[id] are already used throughout the API.
 */
export async function assertStaffCanAccessClient(
  event: H3Event,
  clientUserId: string
): Promise<void> {
  if (event.context.isAdmin) return
  if (!event.context.isClinician) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  const clinicianUserId = event.context.user?.id
  if (!clinicianUserId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const assignedClinicianId = await getAssignedClinicianUserId(clientUserId)
  if (assignedClinicianId !== clinicianUserId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: client not assigned to you' })
  }
}
