import type { H3Event } from 'h3'
import { prisma } from './prisma'

export async function getClientPermissions(userId: string): Promise<{
  canViewScores: boolean
  canViewNotes: boolean
  canViewPlan: boolean
}> {
  const client = await prisma.client.findUnique({
    where: { userId },
    include: { permissions: true },
  })
  if (!client?.permissions) {
    return { canViewScores: false, canViewNotes: false, canViewPlan: false }
  }
  return {
    canViewScores: client.permissions.canViewScores,
    canViewNotes: client.permissions.canViewNotes,
    canViewPlan: client.permissions.canViewPlan,
  }
}

/**
 * Field-level visibility gate for score/severity data on client-facing reads.
 *
 * Access to the record itself must already be decided by assertCanAccessClient
 * before this runs — this only decides whether the *caller* is allowed to see
 * score/severity fields on a record they're already allowed to open.
 *
 * - Staff (admin or the assigned clinician) always see scores.
 * - A client viewing their own record sees scores only when canViewScores is on.
 * - Anyone else (shouldn't reach here if assertCanAccessClient ran first) sees none.
 */
export async function canViewScoresFor(event: H3Event, clientUserId: string): Promise<boolean> {
  if (event.context.isStaff) return true

  const viewerId = event.context.user?.id
  if (!viewerId || viewerId !== clientUserId) return false

  const { canViewScores } = await getClientPermissions(clientUserId)
  return canViewScores
}
