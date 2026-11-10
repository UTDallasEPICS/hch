import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./prisma', () => ({
  prisma: { client: { findMany: vi.fn() } },
}))
vi.mock('./clinician-match', () => ({
  rankCliniciansForClient: vi.fn(),
}))

import { prisma } from './prisma'
import { rankCliniciansForClient } from './clinician-match'
import { listClientsNeedingReassignment } from './reassignment-queue'

const findMany = prisma.client.findMany as unknown as ReturnType<typeof vi.fn>
const rank = rankCliniciansForClient as unknown as ReturnType<typeof vi.fn>

const match = (id: string, score: number) => ({
  clinicianUserId: id,
  clinicianName: id,
  score,
  matchedTagCount: 1,
  currentCaseload: 0,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listClientsNeedingReassignment', () => {
  it('only queries ACTIVE clients with no clinician or a non-clinician', async () => {
    findMany.mockResolvedValue([])
    await listClientsNeedingReassignment()
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'ACTIVE',
          OR: [{ clinicianUserId: null }, { clinician: { role: { not: 'CLINICIAN' } } }],
        },
      })
    )
  })

  it('labels the reason and keeps the top 3 recommendations', async () => {
    findMany.mockResolvedValue([
      {
        id: 'c1',
        userId: 'u1',
        clinicianUserId: 'former-clinician',
        user: { name: 'Alex', email: 'alex@x.test' },
        clinician: { name: 'Dr. Gone' },
      },
      {
        id: 'c2',
        userId: 'u2',
        clinicianUserId: null,
        user: { name: 'Blair', email: 'blair@x.test' },
        clinician: null,
      },
    ])
    rank.mockResolvedValue([match('a', 0.9), match('b', 0.5), match('c', 0.2), match('d', 0)])

    const result = await listClientsNeedingReassignment()

    expect(rank).toHaveBeenCalledWith('c1')
    expect(rank).toHaveBeenCalledWith('c2')
    expect(result[0]).toMatchObject({
      clientUserId: 'u1',
      reason: 'CLINICIAN_LEFT',
      previousClinicianName: 'Dr. Gone',
    })
    expect(result[1]).toMatchObject({
      clientUserId: 'u2',
      reason: 'UNASSIGNED',
      previousClinicianName: null,
    })
    expect(result[0]?.recommendations.map((r) => r.clinicianUserId)).toEqual(['a', 'b', 'c'])
  })
})
