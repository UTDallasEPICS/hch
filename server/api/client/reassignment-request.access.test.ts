import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({ body: {} as Record<string, unknown> }))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual, readBody: vi.fn(async () => state.body) }
})
vi.mock('../../utils/reassignment-request', () => ({
  getReassignmentRequest: vi.fn(),
  createReassignmentRequest: vi.fn(),
  cancelReassignmentRequest: vi.fn(),
}))

import {
  cancelReassignmentRequest,
  createReassignmentRequest,
  getReassignmentRequest,
} from '../../utils/reassignment-request'
import getHandler from './reassignment-request.get'
import postHandler from './reassignment-request.post'
import deleteHandler from './reassignment-request.delete'

function makeEvent(role: 'ADMIN' | 'CLINICIAN' | 'CLIENT', id = `${role}-user`): H3Event {
  return {
    context: {
      user: { id, role },
      isAdmin: role === 'ADMIN',
      isClinician: role === 'CLINICIAN',
      isStaff: role !== 'CLIENT',
    },
  } as unknown as H3Event
}

beforeEach(() => {
  vi.clearAllMocks()
  state.body = {}
})

const handlers = [
  ['GET', getHandler, getReassignmentRequest],
  ['POST', postHandler, createReassignmentRequest],
  ['DELETE', deleteHandler, cancelReassignmentRequest],
] as const

describe.each(handlers)('%s /api/client/reassignment-request', (_m, handler, impl) => {
  it.each(['ADMIN', 'CLINICIAN'] as const)('rejects %s with 403', async (role) => {
    await expect(handler(makeEvent(role))).rejects.toMatchObject({ statusCode: 403 })
    expect(impl).not.toHaveBeenCalled()
  })

  it("acts only on the signed-in client's own id", async () => {
    await handler(makeEvent('CLIENT', 'client-self'))
    expect((impl as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe('client-self')
  })
})

it('POST ignores any client id in the body and passes only the reason', async () => {
  state.body = { reason: 'please', clientUserId: 'someone-else' }
  await postHandler(makeEvent('CLIENT', 'client-self'))
  expect(createReassignmentRequest).toHaveBeenCalledWith('client-self', 'please')
})
