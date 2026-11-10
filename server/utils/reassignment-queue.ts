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
 */
export type ReassignmentReason = 'UNASSIGNED' | 'CLINICIAN_LEFT'

export type ReassignmentQueueItem = {
  clientId: string
  clientUserId: string
  clientName: string
  clientEmail: string
  status: ClientStatus
  reason: ReassignmentReason
  previousClinicianName: string | null
  /** Top matches from the weighted tag algorithm (REQ-F-05b), best first. */
  recommendations: ClinicianMatch[]
}

const RECOMMENDATIONS_PER_CLIENT = 3

/**
 * Every non-archived client who needs a (new) clinician (#181). Archived
 * clients are done with therapy, so they never need one. ACTIVE clients are
 * listed first since they're the ones actually stuck mid-care.
 */
export async function listClientsNeedingReassignment(): Promise<ReassignmentQueueItem[]> {
  const clients = await prisma.client.findMany({
    where: {
      status: { not: 'ARCHIVED' },
      OR: [{ clinicianUserId: null }, { clinician: { role: { not: 'CLINICIAN' } } }],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      clinicianUserId: true,
      user: { select: { name: true, email: true } },
      clinician: { select: { name: true } },
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
      reason: c.clinicianUserId ? ('CLINICIAN_LEFT' as const) : ('UNASSIGNED' as const),
      previousClinicianName: c.clinician?.name ?? null,
      recommendations: (await rankCliniciansForClient(c.id)).slice(0, RECOMMENDATIONS_PER_CLIENT),
    }))
  )
}
