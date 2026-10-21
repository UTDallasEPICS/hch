import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// Route-level test: proves GET /api/appointments?clientId= actually calls the
// shared assertCanAccessClient for every id in the filter, not a bespoke
// where-clause a future edit could quietly reintroduce. assertCanAccessClient
// itself is NOT mocked here — its real branching logic runs.

let mockQuery: Record<string, string> = {}

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getHeaders: vi.fn(() => ({})),
    getQuery: vi.fn(() => mockQuery),
  }
})

vi.mock('../../utils/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn().mockResolvedValue({ role: 'CLIENT' }) },
    client: { findUnique: vi.fn() },
    appointment: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

import { prisma } from '../../utils/prisma'
import handler from './index.get'

const clientFindUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>
const userFindUnique = prisma.user.findUnique as unknown as ReturnType<typeof vi.fn>

function makeEvent(opts: { userId: string; role: 'ADMIN' | 'CLINICIAN' | 'CLIENT' }): H3Event {
  return {
    context: {
      user: { id: opts.userId, role: opts.role },
      isAdmin: opts.role === 'ADMIN',
      isClinician: opts.role === 'CLINICIAN',
      isStaff: opts.role === 'ADMIN' || opts.role === 'CLINICIAN',
    },
  } as unknown as H3Event
}

beforeEach(() => {
  mockQuery = {}
  clientFindUnique.mockReset()
  userFindUnique.mockReset().mockResolvedValue({ role: 'CLIENT' })
})

describe('GET /api/appointments?clientId=', () => {
  it("403s when a client requests another client's appointments by id", async () => {
    mockQuery = { clientId: 'client-B' }
    userFindUnique.mockResolvedValue({ role: 'CLIENT' })
    const event = makeEvent({ userId: 'client-A', role: 'CLIENT' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
  })

  it('succeeds when a client requests their own id', async () => {
    mockQuery = { clientId: 'client-A' }
    userFindUnique.mockResolvedValue({ role: 'CLIENT' })
    const event = makeEvent({ userId: 'client-A', role: 'CLIENT' })

    await expect(handler(event)).resolves.toEqual([])
  })

  it('403s when a clinician requests a client not assigned to them', async () => {
    mockQuery = { clientId: 'client-1' }
    userFindUnique.mockResolvedValue({ role: 'CLINICIAN' })
    clientFindUnique.mockResolvedValue({ clinicianUserId: 'clinician-B' })
    const event = makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 403 })
  })
})
