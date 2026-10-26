import { prisma } from './prisma'

export type ClinicianMatch = {
  clinicianUserId: string
  clinicianName: string | null
  /** 0-1. Higher is a better match. 0 means no shared tags, not "excluded". */
  score: number
  matchedTagCount: number
  /** Count of this clinician's currently ACTIVE clients. Informational only --
   * REQ-F-05's "capacity" concept is not yet defined (no threshold exists),
   * so this is surfaced for the admin queue (REQ-F-05c) to eyeball, not used
   * to filter or exclude anyone. See REQ-F-05b follow-up. */
  currentCaseload: number
}

const MAX_WEIGHT = 5

/**
 * Ranks every clinician against a client's weighted tags (personality +
 * expertise), for the REQ-F-05 reassignment fail-safe (REQ-F-05c admin queue).
 *
 * Scoring: for each of the client's tags, if a clinician has that same tag,
 * contribute (clientWeight * clinicianWeight) to the clinician's raw score.
 * The raw score is normalized by the client's own total possible weight
 * (each client tag's weight * MAX_WEIGHT), giving a 0-1 "how well does this
 * clinician cover what this client needs" score. A clinician's tags that the
 * client doesn't have contribute nothing -- this intentionally does not
 * penalize a clinician for having a broad skill set unrelated to this client.
 *
 * Clinicians with zero matching tags are still included, at score 0, so the
 * admin queue can show a complete list rather than an empty one when no
 * clinician happens to share a tag with a given client.
 */
export async function rankCliniciansForClient(clientId: string): Promise<ClinicianMatch[]> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { tags: true },
  })
  if (!client) {
    throw new Error(`Client not found: ${clientId}`)
  }

  const clientWeightByTagId = new Map<string, number>(client.tags.map((t) => [t.tagId, t.weight]))

  const totalPossibleWeight = client.tags.reduce((sum, t) => sum + t.weight * MAX_WEIGHT, 0)

  const clinicians = await prisma.user.findMany({
    where: { role: 'CLINICIAN' },
    select: {
      id: true,
      name: true,
      clinicianTags: { select: { tagId: true, weight: true } },
      _count: { select: { assignedClients: { where: { status: 'ACTIVE' } } } },
    },
  })

  const matches: ClinicianMatch[] = clinicians.map((clinician) => {
    let rawScore = 0
    let matchedTagCount = 0
    for (const ct of clinician.clinicianTags) {
      const clientWeight = clientWeightByTagId.get(ct.tagId)
      if (clientWeight !== undefined) {
        rawScore += clientWeight * ct.weight
        matchedTagCount += 1
      }
    }
    const score = totalPossibleWeight > 0 ? rawScore / totalPossibleWeight : 0
    return {
      clinicianUserId: clinician.id,
      clinicianName: clinician.name,
      score: Math.round(score * 1000) / 1000,
      matchedTagCount,
      currentCaseload: clinician._count.assignedClients,
    }
  })

  matches.sort((a, b) => b.score - a.score || a.currentCaseload - b.currentCaseload)
  return matches
}
