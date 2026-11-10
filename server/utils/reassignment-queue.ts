import type { ClientStatus } from '../../prisma/generated/client'
import { prisma } from './prisma'
import { rankCliniciansForClient, type ClinicianMatch } from './clinician-match'

/**
 * Why a client is in the reassignment queue (REQ-F-05c):
 * - CLINICIAN_LEFT: still points at a user who is no longer a CLINICIAN
 *   (role changed). That user already lost access -- assertCanAccessClient
 *   only lets clinicians through -- but the client has nobody.
 * - UNASSIGNED: a client with no clinician at all (e.g. the clinician
 *   account was deleted, which SetNulls Client.clinicianUserId).
 * - CLIENT_REQUESTED: the client asked for a new therapist (#182). They keep
 *   their current clinician until an admin reassigns them.
 */
export type ReassignmentReason = 'UNASSIGNED' | 'CLINICIAN_LEFT' | 'CLIENT_REQUESTED'

export type ReassignmentQueueItem = {
  clientId: string
  clientUserId: string
  clientName: string
  clientEmail: string
  status: ClientStatus
  reason: ReassignmentReason
  /** Current clinician for CLIENT_REQUESTED, former one for CLINICIAN_LEFT. */
  previousClinicianName: string | null
  /** Set only for CLIENT_REQUESTED. */
  requestedAt: Date | null
  requestReason: string | null
  /** Top matches from the weighted tag algorithm (REQ-F-05b), best first. */
  recommendations: ClinicianMatch[]
}

const RECOMMENDATIONS_PER_CLIENT = 3

function reasonFor(c: {
  clinicianUserId: string | null
  reassignmentRequestedAt: Date | null
  clinician: { role: string } | null
}): ReassignmentReason {
  if (!c.clinicianUserId) return 'UNASSIGNED'
  if (c.clinician?.role !== 'CLINICIAN') return 'CLINICIAN_LEFT'
  return 'CLIENT_REQUESTED'
}

/**
 * Every non-archived client who needs a (new) clinician (#181). Archived
 * clients are done with therapy, so they never need one. ACTIVE clients are
 * listed first since they're the ones actually stuck mid-care.
 */
export async function listClientsNeedingReassignment(): Promise<ReassignmentQueueItem[]> {
  const clients = await prisma.client.findMany({
    where: {
      status: { not: 'ARCHIVED' },
      OR: [
        { clinicianUserId: null },
        { clinician: { role: { not: 'CLINICIAN' } } },
        { reassignmentRequestedAt: { not: null } },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      clinicianUserId: true,
      reassignmentRequestedAt: true,
      reassignmentRequestReason: true,
      user: { select: { name: true, email: true } },
      clinician: { select: { name: true, role: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })

  const activeFirst = [...clients].sort(
    (a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE')
  )

  return Promise.all(
    activeFirst.map(async (c) => ({
      clientId: c.id,
      clientUserId: c.userId,
      clientName: c.user.name,
      clientEmail: c.user.email,
      status: c.status,
      reason: reasonFor(c),
      previousClinicianName: c.clinician?.name ?? null,
      requestedAt: c.reassignmentRequestedAt,
      requestReason: c.reassignmentRequestReason,
      recommendations: (await rankCliniciansForClient(c.id)).slice(0, RECOMMENDATIONS_PER_CLIENT),
    }))
  )
}
