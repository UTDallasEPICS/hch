import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

// clinician-access.ts pulls in the real prisma client (better-sqlite3 adapter),
// which needs a live DATABASE_URL. These tests only care about the branching
// logic in the helper, so the db is mocked at the module boundary.
vi.mock('./prisma', () => ({
  prisma: {
    client: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from './prisma'
import { assertCanAccessClient, assertStaffCanAccessClient } from './clinician-access'

const findUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>

function makeEvent(opts: {
  userId?: string
  role?: 'ADMIN' | 'CLINICIAN' | 'CLIENT'
  isAdmin?: boolean
  isClinician?: boolean
  isStaff?: boolean
}): H3Event {
  return {
    context: {
      user: opts.userId ? { id: opts.userId, role: opts.role } : undefined,
      isAdmin: opts.isAdmin ?? false,
      isClinician: opts.isClinician ?? false,
      isStaff: opts.isStaff ?? false,
    },
  } as unknown as H3Event
}

async function statusOf(fn: () => Promise<void>): Promise<number | null> {
  try {
    await fn()
    return null
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? null
  }
}

beforeEach(() => {
  findUnique.mockReset()
})

describe('assertCanAccessClient', () => {
  it('lets an admin through for any client', async () => {
    const event = makeEvent({ userId: 'admin-1', role: 'ADMIN', isAdmin: true })
    await expect(assertCanAccessClient(event, 'client-user-999')).resolves.toBeUndefined()
    // Admins short-circuit before any client lookup.
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('blocks a clinician from opening a client assigned to a different clinician', async () => {
    findUnique.mockResolvedValue({ clinicianUserId: 'clinician-B' })
    const event = makeEvent({ userId: 'clinician-A', role: 'CLINICIAN', isClinician: true })

    const status = await statusOf(() => assertCanAccessClient(event, 'client-user-1'))
    expect(status).toBe(403)
  })

  it('lets a clinician open their own assigned client', async () => {
    findUnique.mockResolvedValue({ clinicianUserId: 'clinician-A' })
    const event = makeEvent({ userId: 'clinician-A', role: 'CLINICIAN', isClinician: true })

    await expect(assertCanAccessClient(event, 'client-user-1')).resolves.toBeUndefined()
  })

  it("blocks a client from opening another client's record", async () => {
    const event = makeEvent({ userId: 'client-A', role: 'CLIENT' })
    const status = await statusOf(() => assertCanAccessClient(event, 'client-B'))
    expect(status).toBe(403)
  })

  it('lets a client open only their own record', async () => {
    const event = makeEvent({ userId: 'client-A', role: 'CLIENT' })
    await expect(assertCanAccessClient(event, 'client-A')).resolves.toBeUndefined()
  })

  it('blocks a clinician the instant they are unassigned, on the very next call', async () => {
    const event = makeEvent({ userId: 'clinician-A', role: 'CLINICIAN', isClinician: true })

    // Call 1: still assigned.
    findUnique.mockResolvedValueOnce({ clinicianUserId: 'clinician-A' })
    await expect(assertCanAccessClient(event, 'client-user-1')).resolves.toBeUndefined()

    // Reassignment happens server-side between requests (no new session/token
    // for the clinician — the helper must re-check the db every call).
    findUnique.mockResolvedValueOnce({ clinicianUserId: 'clinician-B' })
    const status = await statusOf(() => assertCanAccessClient(event, 'client-user-1'))
    expect(status).toBe(403)
  })

  it('rejects when there is no signed-in user', async () => {
    const event = makeEvent({})
    const status = await statusOf(() => assertCanAccessClient(event, 'client-user-1'))
    expect(status).toBe(403)
  })
})

describe('assertStaffCanAccessClient', () => {
  it('rejects a client even for their own record', async () => {
    const event = makeEvent({ userId: 'client-A', role: 'CLIENT', isStaff: false })
    const status = await statusOf(() => assertStaffCanAccessClient(event, 'client-A'))
    expect(status).toBe(403)
  })

  it('allows an assigned clinician (staff)', async () => {
    findUnique.mockResolvedValue({ clinicianUserId: 'clinician-A' })
    const event = makeEvent({
      userId: 'clinician-A',
      role: 'CLINICIAN',
      isClinician: true,
      isStaff: true,
    })
    await expect(assertStaffCanAccessClient(event, 'client-user-1')).resolves.toBeUndefined()
  })
})
