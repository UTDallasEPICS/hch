import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
  headers: {} as Record<string, string>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
    getQuery: vi.fn(() => state.query),
    setResponseHeader: vi.fn((_event: unknown, name: string, value: string) => {
      state.headers[name] = value
    }),
  }
})

// The route runs against a real, fully migrated SQLite DB.
vi.mock('../../../../utils/prisma', async () => {
  const { createTestPrisma } = await import('../../../../test-helpers/test-db')
  return { prisma: createTestPrisma() }
})

import { prisma } from '../../../../utils/prisma'
import { seedSession } from '../../../../test-helpers/test-db'
import exportGet from './export.get'

function makeEvent(id: string, role: 'ADMIN' | 'CLINICIAN'): H3Event {
  return {
    context: {
      user: { id, role, name: 'avery||admin', email: `${id}@example.test` },
      isAdmin: role === 'ADMIN',
      isClinician: role === 'CLINICIAN',
      isStaff: true,
    },
  } as unknown as H3Event
}

let clinicianId = ''

beforeAll(async () => {
  const seeded = await seedSession(prisma, { suffix: 'export' })
  clinicianId = seeded.clinician.id
})

beforeEach(() => {
  state.params = { id: clinicianId }
  state.query = {}
  state.headers = {}
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('GET /api/clinicians/[id]/session-log/export', () => {
  it('returns a CSV download and records the export', async () => {
    state.query = { from: '2026-01-01', to: '2026-11-30' }
    const csv = await exportGet(makeEvent('admin-1', 'ADMIN'))

    expect(state.headers['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(state.headers['Content-Disposition']).toBe(
      'attachment; filename="session-log-dana-lee-2026-01-01-to-2026-11-30.csv"'
    )
    expect(csv).toContain('Exported by,Avery Admin')

    const exports = await prisma.sessionLogExport.findMany()
    expect(exports).toHaveLength(1)
    expect(exports[0]).toMatchObject({ exportedById: 'admin-1', clinicianUserId: clinicianId })
    expect(exports[0]?.rangeFrom).toBeInstanceOf(Date)
  })

  it("records nothing when a clinician tries to export someone else's log", async () => {
    const before = await prisma.sessionLogExport.count()
    await expect(exportGet(makeEvent('other-clinician', 'CLINICIAN'))).rejects.toMatchObject({
      statusCode: 403,
    })
    expect(await prisma.sessionLogExport.count()).toBe(before)
  })
})
