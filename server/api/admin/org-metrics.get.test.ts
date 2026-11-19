import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({ query: {} as Record<string, string> }))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return { ...actual, getQuery: vi.fn(() => state.query) }
})

vi.mock('../../utils/prisma', () => ({
  prisma: {
    sessionLog: { findMany: vi.fn(async () => []) },
    client: { count: vi.fn(async () => 3) },
  },
}))

import { prisma } from '../../utils/prisma'
import orgMetricsGet from './org-metrics.get'

const findMany = prisma.sessionLog.findMany as unknown as ReturnType<typeof vi.fn>

function makeEvent(role: 'ADMIN' | 'CLINICIAN' | 'CLIENT' | null): H3Event {
  return {
    context: {
      user: role ? { id: `${role.toLowerCase()}-1`, role } : undefined,
      isAdmin: role === 'ADMIN',
      isClinician: role === 'CLINICIAN',
      isStaff: role === 'ADMIN' || role === 'CLINICIAN',
    },
  } as unknown as H3Event
}

beforeEach(() => {
  state.query = {}
  findMany.mockClear()
})

describe('GET /api/admin/org-metrics', () => {
  it('returns 401 when signed out', async () => {
    await expect(orgMetricsGet(makeEvent(null))).rejects.toMatchObject({ statusCode: 401 })
  })

  it.each(['CLINICIAN', 'CLIENT'] as const)('returns 403 for a %s', async (role) => {
    await expect(orgMetricsGet(makeEvent(role))).rejects.toMatchObject({ statusCode: 403 })
    expect(findMany).not.toHaveBeenCalled()
  })

  it('returns metrics for an admin', async () => {
    const result = await orgMetricsGet(makeEvent('ADMIN'))
    expect(result.totals).toMatchObject({ activeClients: 3, cumulativeHours: 0 })
    expect(result.months).toHaveLength(12)
  })

  it('rejects a malformed date', async () => {
    state.query = { from: '11/01/2026' }
    await expect(orgMetricsGet(makeEvent('ADMIN'))).rejects.toMatchObject({ statusCode: 400 })
  })
})
