import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({ params: {} as Record<string, string> }))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
  }
})
vi.mock('../utils/prisma', () => ({
  prisma: { client: { findUnique: vi.fn() } },
}))
vi.mock('../utils/clinician-match', () => ({ rankCliniciansForClient: vi.fn() }))
vi.mock('../utils/reassignment-queue', () => ({ listClientsNeedingReassignment: vi.fn() }))

import { prisma } from '../utils/prisma'
import { rankCliniciansForClient } from '../utils/clinician-match'
import { listClientsNeedingReassignment } from '../utils/reassignment-queue'
import queueGet from './admin/reassignment-queue.get'
import recommendationsGet from './clients/[id]/clinician-recommendations.get'

const clientFindUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>
const rank = rankCliniciansForClient as unknown as ReturnType<typeof vi.fn>
const listQueue = listClientsNeedingReassignment as unknown as ReturnType<typeof vi.fn>

function makeEvent(role: 'ADMIN' | 'CLINICIAN' | 'CLIENT'): H3Event {
  return {
    context: {
      user: { id: `${role}-user`, role },
      isAdmin: role === 'ADMIN',
      isClinician: role === 'CLINICIAN',
      isStaff: role !== 'CLIENT',
    },
  } as unknown as H3Event
}

beforeEach(() => {
  vi.clearAllMocks()
  state.params = { id: 'client-user-1' }
})

describe('GET /api/admin/reassignment-queue', () => {
  it.each(['CLINICIAN', 'CLIENT'] as const)('rejects %s with 403', async (role) => {
    await expect(queueGet(makeEvent(role))).rejects.toMatchObject({ statusCode: 403 })
    expect(listQueue).not.toHaveBeenCalled()
  })

  it('returns the queue for admins', async () => {
    listQueue.mockResolvedValue([{ clientUserId: 'u1' }])
    await expect(queueGet(makeEvent('ADMIN'))).resolves.toEqual([{ clientUserId: 'u1' }])
  })
})

describe('GET /api/clients/[id]/clinician-recommendations', () => {
  it.each(['CLINICIAN', 'CLIENT'] as const)('rejects %s with 403', async (role) => {
    await expect(recommendationsGet(makeEvent(role))).rejects.toMatchObject({ statusCode: 403 })
    expect(rank).not.toHaveBeenCalled()
  })

  it('404s when the client user has no client record', async () => {
    clientFindUnique.mockResolvedValue(null)
    await expect(recommendationsGet(makeEvent('ADMIN'))).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('ranks by Client.id, looked up from the route user id', async () => {
    clientFindUnique.mockResolvedValue({ id: 'client-row-1' })
    rank.mockResolvedValue([])
    await recommendationsGet(makeEvent('ADMIN'))
    expect(clientFindUnique).toHaveBeenCalledWith({
      where: { userId: 'client-user-1' },
      select: { id: true },
    })
    expect(rank).toHaveBeenCalledWith('client-row-1')
  })
})
