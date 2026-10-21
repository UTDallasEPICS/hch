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
 * Staff-only wrapper around assertCanAccessClient.
 * Admins and assigned clinicians pass. Clients are rejected even for their own record.
 *
 * Pass the client's USER id (the User.id stored on Client.userId), matching how
 * route params like /clients/[id] are already used throughout the API.
 */
export async function assertStaffCanAccessClient(
  event: H3Event,
  clientUserId: string
): Promise<void> {
  await assertCanAccessClient(event, clientUserId)
  if (!event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
}

/**
 * Shared "may this user touch this client?" check for PHI routes.
 * - Admins always pass (clinic-wide).
 * - Clinicians pass only if they're assigned (Client.clinicianUserId == user.id).
 * - Clients pass only for their own record (route id == user.id).
 * - Anyone else is rejected (403).
 *
 * Pass the client's USER id (the User.id stored on Client.userId), matching how
 * route params like /clients/[id] are already used throughout the API.
 */
export async function assertCanAccessClient(
  event: H3Event,
  clientUserId: string
): Promise<void> {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (event.context.isAdmin) return

  if (event.context.isClinician) {
    const assignedClinicianId = await getAssignedClinicianUserId(clientUserId)
    if (assignedClinicianId !== userId) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Forbidden: client not assigned to you',
      })
    }
    return
  }

  if (event.context.user?.role === 'CLIENT' && userId === clientUserId) return

  throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
}
