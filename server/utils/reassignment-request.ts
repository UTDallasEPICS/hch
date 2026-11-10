import { createError } from 'h3'
import { prisma } from './prisma'
import { notifyAdmins } from './notifications'
import { formatStoredUserNameForDisplay } from './name'

/**
 * #182: a client asks for a new therapist. Product decision: the client KEEPS
 * their current clinician (and that clinician keeps access) until an admin
 * reassigns them from the #181 queue -- no gap in care. Reassignment via
 * PATCH /api/clients/[id]/clinician clears the request, and access then moves
 * because assertCanAccessClient keys off Client.clinicianUserId.
 */

export const MAX_REASON_LENGTH = 1000

export type ReassignmentRequestState = {
  hasClinician: boolean
  requestedAt: Date | null
  reason: string | null
}

async function loadOwnClient(clientUserId: string) {
  const client = await prisma.client.findUnique({
    where: { userId: clientUserId },
    select: {
      id: true,
      clinicianUserId: true,
      reassignmentRequestedAt: true,
      reassignmentRequestReason: true,
      user: { select: { name: true, email: true } },
    },
  })
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client profile not found' })
  }
  return client
}

export async function getReassignmentRequest(
  clientUserId: string
): Promise<ReassignmentRequestState> {
  const client = await loadOwnClient(clientUserId)
  return {
    hasClinician: client.clinicianUserId !== null,
    requestedAt: client.reassignmentRequestedAt,
    reason: client.reassignmentRequestReason,
  }
}

export async function createReassignmentRequest(
  clientUserId: string,
  rawReason: unknown
): Promise<ReassignmentRequestState> {
  if (rawReason != null && typeof rawReason !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Reason must be text' })
  }
  const reason = rawReason?.trim() || null
  if (reason && reason.length > MAX_REASON_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Reason must be ${MAX_REASON_LENGTH} characters or fewer`,
    })
  }

  const client = await loadOwnClient(clientUserId)
  if (!client.clinicianUserId) {
    // Already in the admin queue as UNASSIGNED; nothing to request.
    throw createError({
      statusCode: 409,
      statusMessage: 'You do not have a therapist assigned yet',
    })
  }
  if (client.reassignmentRequestedAt) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already asked for a new therapist',
    })
  }

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: { reassignmentRequestedAt: new Date(), reassignmentRequestReason: reason },
    select: { reassignmentRequestedAt: true, reassignmentRequestReason: true },
  })

  const name = formatStoredUserNameForDisplay(client.user.name ?? '') || client.user.email
  await notifyAdmins({
    type: 'REASSIGNMENT_REQUESTED',
    title: 'Client requested a new therapist',
    message: `${name} asked to be matched with a different therapist.`,
  })

  return {
    hasClinician: true,
    requestedAt: updated.reassignmentRequestedAt,
    reason: updated.reassignmentRequestReason,
  }
}

export async function cancelReassignmentRequest(
  clientUserId: string
): Promise<ReassignmentRequestState> {
  const client = await loadOwnClient(clientUserId)
  if (client.reassignmentRequestedAt) {
    await prisma.client.update({
      where: { id: client.id },
      data: { reassignmentRequestedAt: null, reassignmentRequestReason: null },
    })
  }
  return { hasClinician: client.clinicianUserId !== null, requestedAt: null, reason: null }
}
