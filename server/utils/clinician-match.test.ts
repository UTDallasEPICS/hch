import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./prisma', () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
  },
}))

import { prisma } from './prisma'
import { rankCliniciansForClient } from './clinician-match'

const clientFindUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>
const userFindMany = prisma.user.findMany as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('rankCliniciansForClient', () => {
  it('throws when the client does not exist', async () => {
    clientFindUnique.mockResolvedValue(null)
    await expect(rankCliniciansForClient('missing-client')).rejects.toThrow('Client not found')
  })

  it('scores a perfect match at 1.0', async () => {
    clientFindUnique.mockResolvedValue({
      id: 'client-1',
      tags: [{ tagId: 'trauma', weight: 5 }],
    })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-A',
        name: 'Dr. A',
        clinicianTags: [{ tagId: 'trauma', weight: 5 }],
        _count: { assignedClients: 2 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result).toEqual([
      {
        clinicianUserId: 'clinician-A',
        clinicianName: 'Dr. A',
        score: 1,
        matchedTagCount: 1,
        currentCaseload: 2,
      },
    ])
  })

  it('still includes clinicians with zero matching tags, at score 0', async () => {
    clientFindUnique.mockResolvedValue({
      id: 'client-1',
      tags: [{ tagId: 'trauma', weight: 5 }],
    })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-B',
        name: 'Dr. B',
        clinicianTags: [{ tagId: 'anxiety', weight: 5 }], // no overlap
        _count: { assignedClients: 0 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result).toHaveLength(1)
    expect(result[0].score).toBe(0)
    expect(result[0].matchedTagCount).toBe(0)
  })

  it("does not let a clinician's unrelated tags inflate or deflate their score", async () => {
    clientFindUnique.mockResolvedValue({
      id: 'client-1',
      tags: [{ tagId: 'trauma', weight: 5 }],
    })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-C',
        name: 'Dr. C (broad skillset)',
        clinicianTags: [
          { tagId: 'trauma', weight: 5 },
          { tagId: 'grief', weight: 5 },
          { tagId: 'family-systems', weight: 5 },
        ],
        _count: { assignedClients: 5 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result[0].score).toBe(1) // same as a clinician who ONLY has the trauma tag
    expect(result[0].matchedTagCount).toBe(1)
  })

  it('ranks higher weighted overlap above lower, and sorts descending', async () => {
    clientFindUnique.mockResolvedValue({
      id: 'client-1',
      tags: [
        { tagId: 'trauma', weight: 5 },
        { tagId: 'anxiety', weight: 3 },
      ],
    })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-weak',
        name: 'Dr. Weak',
        clinicianTags: [{ tagId: 'anxiety', weight: 1 }],
        _count: { assignedClients: 0 },
      },
      {
        id: 'clinician-strong',
        name: 'Dr. Strong',
        clinicianTags: [
          { tagId: 'trauma', weight: 5 },
          { tagId: 'anxiety', weight: 5 },
        ],
        _count: { assignedClients: 0 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result[0].clinicianUserId).toBe('clinician-strong')
    expect(result[1].clinicianUserId).toBe('clinician-weak')
    expect(result[0].score).toBeGreaterThan(result[1].score)
  })

  it('breaks ties by lower current caseload first', async () => {
    clientFindUnique.mockResolvedValue({
      id: 'client-1',
      tags: [{ tagId: 'trauma', weight: 5 }],
    })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-busy',
        name: 'Dr. Busy',
        clinicianTags: [{ tagId: 'trauma', weight: 5 }],
        _count: { assignedClients: 10 },
      },
      {
        id: 'clinician-free',
        name: 'Dr. Free',
        clinicianTags: [{ tagId: 'trauma', weight: 5 }],
        _count: { assignedClients: 1 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result[0].clinicianUserId).toBe('clinician-free')
    expect(result[1].clinicianUserId).toBe('clinician-busy')
  })

  it('handles a client with no tags at all (score 0 for everyone, no division by zero)', async () => {
    clientFindUnique.mockResolvedValue({ id: 'client-1', tags: [] })
    userFindMany.mockResolvedValue([
      {
        id: 'clinician-A',
        name: 'Dr. A',
        clinicianTags: [{ tagId: 'trauma', weight: 5 }],
        _count: { assignedClients: 0 },
      },
    ])

    const result = await rankCliniciansForClient('client-1')
    expect(result[0].score).toBe(0)
    expect(Number.isFinite(result[0].score)).toBe(true)
  })
})
