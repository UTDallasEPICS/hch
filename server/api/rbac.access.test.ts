import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
    readBody: vi.fn(async () => state.body),
  }
})

vi.mock('../utils/prisma', () => ({
  prisma: {
    client: { findUnique: vi.fn() },
    user: { findFirst: vi.fn(), findUnique: vi.fn() },
    declarationTemplate: {
      findFirst: vi.fn(async () => ({ id: 'template' })),
      create: vi.fn(async () => ({ id: 'template' })),
    },
    clientFormScoreHistory: {
      count: vi.fn(async () => 1),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '../utils/prisma'
import profileGet from './clients/[id]/profile.get'
import formGet from './clients/[id]/forms/[formKey].get'
import historyGet from './clients/[id]/forms/[formKey]/history.get'
import notesGet from './clients/[id]/notes-editor-data.get'
import rawFormGet from './clients/[id]/forms/[formKey]/raw.get'
import clientPatch from './clients/[id].patch'

const clientFindUnique = prisma.client.findUnique as unknown as ReturnType<typeof vi.fn>
const historyFindMany = prisma.clientFormScoreHistory.findMany as unknown as ReturnType<typeof vi.fn>
const userFindFirst = prisma.user.findFirst as unknown as ReturnType<typeof vi.fn>

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
  state.params = {}
  state.body = {}
  clientFindUnique.mockReset()
  historyFindMany.mockReset()
  userFindFirst.mockReset()
})

describe('a client cannot open another client by id', () => {
  it('blocks profile GET', async () => {
    state.params = { id: 'client-B' }
    await expect(profileGet(makeEvent({ userId: 'client-A', role: 'CLIENT' }))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('blocks form GET', async () => {
    state.params = { id: 'client-B', formKey: 'gad' }
    await expect(formGet(makeEvent({ userId: 'client-A', role: 'CLIENT' }))).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('blocks the raw uploaded form', async () => {
    state.params = { id: 'client-B', formKey: 'application' }
    await expect(rawFormGet(makeEvent({ userId: 'client-A', role: 'CLIENT' }))).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})

describe('a clinician cannot open or edit a client assigned to someone else', () => {
  it('blocks profile GET', async () => {
    state.params = { id: 'client-1' }
    clientFindUnique.mockResolvedValue({ clinicianUserId: 'clinician-B' })
    await expect(
      profileGet(makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' }))
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('blocks notes GET', async () => {
    state.params = { id: 'client-1' }
    clientFindUnique.mockResolvedValue({ clinicianUserId: 'clinician-B' })
    await expect(
      notesGet(makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' }))
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('blocks client PATCH', async () => {
    state.params = { id: 'client-1' }
    state.body = { status: 'Active' }
    clientFindUnique.mockResolvedValue({ clinicianUserId: 'clinician-B' })
    await expect(
      clientPatch(makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' }))
    ).rejects.toMatchObject({ statusCode: 403 })
  })
})

describe('score visibility', () => {
  const historyRow = {
    id: 'row-1',
    score: 9,
    severity: 'Mild',
    recordedAt: new Date('2026-01-01T00:00:00.000Z'),
    answersJson: null,
  }

  it('hides score and severity from a client when canViewScores is off', async () => {
    state.params = { id: 'client-A', formKey: 'gad' }
    clientFindUnique.mockResolvedValue({
      permissions: { canViewScores: false, canViewNotes: false, canViewPlan: false },
    })
    userFindFirst.mockResolvedValue({ id: 'client-A', role: 'CLIENT' })
    historyFindMany.mockResolvedValue([historyRow])

    const result = await historyGet(makeEvent({ userId: 'client-A', role: 'CLIENT' }))
    expect(result.events[0]?.score).toBeNull()
    expect(result.events[0]?.severity).toBeNull()
  })

  it('still shows scores to staff when the client flag is off', async () => {
    state.params = { id: 'client-A', formKey: 'gad' }
    clientFindUnique.mockResolvedValue({
      clinicianUserId: 'clinician-A',
      permissions: { canViewScores: false, canViewNotes: false, canViewPlan: false },
    })
    userFindFirst.mockResolvedValue({ id: 'client-A', role: 'CLIENT' })
    historyFindMany.mockResolvedValue([historyRow])

    const result = await historyGet(makeEvent({ userId: 'clinician-A', role: 'CLINICIAN' }))
    expect(result.events[0]?.score).toBe(9)
    expect(result.events[0]?.severity).toBe('Mild')
  })
})
