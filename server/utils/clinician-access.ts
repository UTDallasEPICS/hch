import { H3Event, createError } from 'h3'
import { prisma } from './prisma'

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
  const client = await prisma.client.findUnique({
    where: { userId: clientUserId },
    select: { clinicianUserId: true },
  })
  if (!client || client.clinicianUserId !== clinicianUserId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: client not assigned to you' })
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
    const client = await prisma.client.findUnique({
      where: { userId: clientUserId },
      select: { clinicianUserId: true },
    })
    if (!client || client.clinicianUserId !== userId) {
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
