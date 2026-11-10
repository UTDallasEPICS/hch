import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./prisma', () => ({
  prisma: { client: { findUnique: vi.fn(), update: vi.fn() } },
}))
vi.mock('./notifications', () => ({ notifyAdmins: vi.fn() }))

import { prisma } from './prisma'
import { notifyAdmins } from './notifications'
import {
  cancelReassignmentRequest,
  createReassignmentRequest,
  getReassignmentRequest,
  MAX_REASON_LENGTH,
} from './reassignment-request'

const findUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>
const update = prisma.client.update as unknown as ReturnType<typeof vi.fn>
const notify = notifyAdmins as unknown as ReturnType<typeof vi.fn>

const clientRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'client-row',
  clinicianUserId: 'doc',
  reassignmentRequestedAt: null,
  reassignmentRequestReason: null,
  user: { name: 'Alex Smith', email: 'alex@x.test' },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  update.mockImplementation(async ({ data }) => data)
})

describe('createReassignmentRequest', () => {
  it("only ever looks up the caller's own client record", async () => {
    findUnique.mockResolvedValue(clientRow())
    await createReassignmentRequest('me', 'reason')
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'me' } }))
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'client-row' } }))
  })

  it('flags the request without touching clinicianUserId, and pings admins', async () => {
    findUnique.mockResolvedValue(clientRow())
    const result = await createReassignmentRequest('me', '  not a good fit  ')

    const data = update.mock.calls[0]?.[0].data
    expect(data).not.toHaveProperty('clinicianUserId')
    expect(data.reassignmentRequestedAt).toBeInstanceOf(Date)
    expect(data.reassignmentRequestReason).toBe('not a good fit')
    expect(result.hasClinician).toBe(true)
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'REASSIGNMENT_REQUESTED' }))
  })

  it('stores a blank reason as null', async () => {
    findUnique.mockResolvedValue(clientRow())
    await createReassignmentRequest('me', '   ')
    expect(update.mock.calls[0]?.[0].data.reassignmentRequestReason).toBeNull()
  })

  it('rejects a duplicate request with 409', async () => {
    findUnique.mockResolvedValue(clientRow({ reassignmentRequestedAt: new Date() }))
    await expect(createReassignmentRequest('me', null)).rejects.toMatchObject({ statusCode: 409 })
    expect(update).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects with 409 when the client has no therapist to replace', async () => {
    findUnique.mockResolvedValue(clientRow({ clinicianUserId: null }))
    await expect(createReassignmentRequest('me', null)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects an over-long or non-text reason with 400', async () => {
    findUnique.mockResolvedValue(clientRow())
    await expect(
      createReassignmentRequest('me', 'x'.repeat(MAX_REASON_LENGTH + 1))
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(createReassignmentRequest('me', 42)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('404s when the caller has no client record', async () => {
    findUnique.mockResolvedValue(null)
    await expect(createReassignmentRequest('me', null)).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('get / cancel', () => {
  it('reports the pending request', async () => {
    const at = new Date()
    findUnique.mockResolvedValue(clientRow({ reassignmentRequestedAt: at }))
    await expect(getReassignmentRequest('me')).resolves.toEqual({
      hasClinician: true,
      requestedAt: at,
      reason: null,
    })
  })

  it('cancelling clears the flags', async () => {
    findUnique.mockResolvedValue(clientRow({ reassignmentRequestedAt: new Date() }))
    await cancelReassignmentRequest('me')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'client-row' },
      data: { reassignmentRequestedAt: null, reassignmentRequestReason: null },
    })
  })

  it('cancelling with nothing pending is a no-op', async () => {
    findUnique.mockResolvedValue(clientRow())
    await cancelReassignmentRequest('me')
    expect(update).not.toHaveBeenCalled()
  })
})
