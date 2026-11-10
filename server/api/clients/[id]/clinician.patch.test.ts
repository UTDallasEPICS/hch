import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({ body: {} as Record<string, unknown> }))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn(() => 'client-user'),
    readBody: vi.fn(async () => state.body),
  }
})
vi.mock('../../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findFirst: vi.fn() },
    client: { update: vi.fn(), create: vi.fn() },
  },
}))

import { prisma } from '../../../utils/prisma'
import handler from './clinician.patch'

const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>
const userFindFirst = prisma.user.findFirst as unknown as ReturnType<typeof vi.fn>
const clientUpdate = prisma.client.update as unknown as ReturnType<typeof vi.fn>

const adminEvent = {
  context: {
    user: { id: 'admin', role: 'ADMIN' },
    isAdmin: true,
    isClinician: false,
    isStaff: true,
  },
} as unknown as H3Event

beforeEach(() => {
  vi.clearAllMocks()
  userFindUnique.mockResolvedValue({ role: 'CLINICIAN' })
  userFindFirst.mockResolvedValue({ id: 'client-user', client: { id: 'client-row' } })
  clientUpdate.mockImplementation(async ({ data }) => ({ clinicianUserId: data.clinicianUserId }))
})

describe('PATCH /api/clients/[id]/clinician (#182 request handling)', () => {
  it('assigning a clinician clears a pending "new therapist" request', async () => {
    state.body = { clinicianUserId: 'doc-new' }
    await handler(adminEvent)
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: 'client-row' },
      data: {
        clinicianUserId: 'doc-new',
        reassignmentRequestedAt: null,
        reassignmentRequestReason: null,
      },
    })
  })

  it('unassigning keeps the request, since the client still needs a therapist', async () => {
    state.body = { clinicianUserId: null }
    await handler(adminEvent)
    expect(clientUpdate).toHaveBeenCalledWith({
      where: { id: 'client-row' },
      data: { clinicianUserId: null },
    })
  })
})
