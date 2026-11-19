import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H3Event } from 'h3'

// REQ-F-11 (#219): access and integrity tests for the session log and admin metrics.
// Routes run against a real, fully migrated SQLite DB (so the triggers are live).

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  query: {} as Record<string, string>,
  body: {} as Record<string, unknown>,
}))

vi.mock('h3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    getRouterParam: vi.fn((_event: unknown, name: string) => state.params[name]),
    getQuery: vi.fn(() => state.query),
    readBody: vi.fn(async () => state.body),
    setResponseHeader: vi.fn(),
  }
})

vi.mock('../utils/prisma', async () => {
  const { createTestPrisma } = await import('../test-helpers/test-db')
  return { prisma: createTestPrisma() }
})

// No email or in-app notifications from the note routes in tests.
vi.mock('../utils/notifications', () => ({
  notifyAdmins: vi.fn(async () => {}),
  notifyUser: vi.fn(async () => {}),
}))

import { prisma } from '../utils/prisma'
import { seedSession } from '../test-helpers/test-db'
import orgMetricsGet from './admin/org-metrics.get'
import backfillPost from './admin/backfill-session-log.post'
import sessionLogGet from './clinicians/[id]/session-log.get'
import exportGet from './clinicians/[id]/session-log/export.get'
import notesPost from './clients/[id]/notes.post'
import notePatch from './clients/[id]/session-notes/[noteId].patch'

type Role = 'ADMIN' | 'CLINICIAN' | 'CLIENT'

function makeEvent(user: { id: string; role: Role } | null): H3Event {
  return {
    context: {
      user: user
        ? { ...user, name: `${user.id}||test`, email: `${user.id}@example.test` }
        : undefined,
      isAdmin: user?.role === 'ADMIN',
      isClinician: user?.role === 'CLINICIAN',
      isStaff: user?.role === 'ADMIN' || user?.role === 'CLINICIAN',
    },
  } as unknown as H3Event
}

async function statusOf(run: () => Promise<unknown>): Promise<number | 'ok'> {
  try {
    await run()
    return 'ok'
  } catch (err) {
    return (err as { statusCode?: number }).statusCode ?? 500
  }
}

const SIGNATURE = '{"type":"font-signature","text":"Dana Lee"}'
let seeded: Awaited<ReturnType<typeof seedSession>>
let clinicianA = { id: '', role: 'CLINICIAN' as Role }
const clinicianB = { id: 'clinician-B', role: 'CLINICIAN' as Role }
const admin = { id: 'admin-1', role: 'ADMIN' as Role }
let client = { id: '', role: 'CLIENT' as Role }

beforeAll(async () => {
  seeded = await seedSession(prisma, { suffix: 'A' })
  clinicianA = { id: seeded.clinician.id, role: 'CLINICIAN' }
  client = { id: seeded.clientUser.id, role: 'CLIENT' }
  await prisma.user.create({
    data: { id: clinicianB.id, name: 'b||b', email: 'b@example.test', role: 'CLINICIAN' },
  })
})

beforeEach(() => {
  state.params = {}
  state.query = {}
  state.body = {}
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('who can reach the new routes', () => {
  const routes = {
    'GET /api/admin/org-metrics': () => orgMetricsGet,
    'POST /api/admin/backfill-session-log?dryRun=true': () => backfillPost,
    "GET clinician A's session log": () => sessionLogGet,
    "GET clinician A's session log export": () => exportGet,
  } as const

  function call(route: keyof typeof routes, user: { id: string; role: Role } | null) {
    state.params = { id: clinicianA.id }
    state.query = route.includes('backfill') ? { dryRun: 'true' } : {}
    return statusOf(() => routes[route]()(makeEvent(user)))
  }

  it.each(Object.keys(routes) as (keyof typeof routes)[])('%s: 401 when signed out', async (r) => {
    expect(await call(r, null)).toBe(401)
  })

  it.each(Object.keys(routes) as (keyof typeof routes)[])('%s: 403 for a client', async (r) => {
    expect(await call(r, client)).toBe(403)
  })

  it.each(Object.keys(routes) as (keyof typeof routes)[])('%s: allowed for an admin', async (r) => {
    expect(await call(r, admin)).toBe('ok')
  })

  it('admin-only routes: 403 for a clinician', async () => {
    expect(await call('GET /api/admin/org-metrics', clinicianA)).toBe(403)
    expect(await call('POST /api/admin/backfill-session-log?dryRun=true', clinicianA)).toBe(403)
  })

  it("clinician B cannot read or export clinician A's log", async () => {
    expect(await call("GET clinician A's session log", clinicianB)).toBe(403)
    expect(await call("GET clinician A's session log export", clinicianB)).toBe(403)
  })

  it('clinician A can read and export their own log', async () => {
    expect(await call("GET clinician A's session log", clinicianA)).toBe('ok')
    expect(await call("GET clinician A's session log export", clinicianA)).toBe('ok')
  })
})

describe('the log cannot be changed', () => {
  // Through Prisma's SQLite adapter the trigger's RAISE(ABORT) surfaces as a generic
  // constraint error ("Foreign key constraint violated"), not the trigger message, so
  // these check that the write fails and the row is unchanged.
  it('Prisma update and delete on session_log are rejected by the database', async () => {
    const row = await prisma.sessionLog.create({
      data: {
        event: 'SIGNED',
        sessionNoteId: 'note-immutable',
        clinicianUserId: 'clinician-immutable', // kept out of the end-to-end export below
        clinicianName: 'Dana Lee',
        clientUserId: client.id,
        sessionStart: new Date('2026-11-02T15:00:00.000Z'),
        sessionEnd: new Date('2026-11-02T16:00:00.000Z'),
        durationMinutes: 60,
        countedMinutes: 60,
        attendanceStatus: 'show',
        noteStatus: 'CLINICIAN_SIGNED',
        noteKind: 'PROGRESS',
        recordedById: 'clinician-immutable',
      },
    })

    await expect(
      prisma.sessionLog.update({ where: { id: row.id }, data: { countedMinutes: 600 } })
    ).rejects.toThrow()
    await expect(prisma.sessionLog.delete({ where: { id: row.id } })).rejects.toThrow()
    await expect(prisma.sessionLog.deleteMany()).rejects.toThrow()

    expect(await prisma.sessionLog.findUnique({ where: { id: row.id } })).toMatchObject({
      countedMinutes: 60,
    })
  })

  it('Prisma update and delete on session_log_export are rejected by the database', async () => {
    const row = await prisma.sessionLogExport.create({
      data: { exportedById: admin.id, clinicianUserId: clinicianA.id, rowCount: 0 },
    })
    await expect(prisma.sessionLogExport.deleteMany()).rejects.toThrow()
    await expect(prisma.sessionLogExport.updateMany({ data: { rowCount: 9 } })).rejects.toThrow()
    expect(await prisma.sessionLogExport.findUnique({ where: { id: row.id } })).toMatchObject({
      rowCount: 0,
    })
  })

  it('no server code updates or deletes session_log or session_log_export rows', () => {
    const serverDir = fileURLToPath(new URL('..', import.meta.url))
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (name !== 'test-helpers' && name !== 'node_modules') walk(path)
        } else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) {
          const src = readFileSync(path, 'utf8')
          if (
            /sessionLog(Export)?\s*\.\s*(update|updateMany|upsert|delete|deleteMany)\b/.test(src) ||
            /(UPDATE|DELETE\s+FROM)\s+"?session_log/i.test(src)
          ) {
            offenders.push(path.slice(serverDir.length))
          }
        }
      }
    }
    walk(serverDir)
    expect(offenders).toEqual([])
  })
})

describe('end to end: sign, correct, export', () => {
  it('the CSV shows the original entry, its correction, and the right total', async () => {
    // 1. The clinician signs the placeholder note with attendance `show`.
    state.params = { id: client.id }
    state.body = {
      content: 'Session went well.',
      attendanceStatus: 'show',
      appointmentId: seeded.appointment.id,
      action: 'clinician-sign',
      clinicianSignatureData: SIGNATURE,
    }
    await notesPost(makeEvent(clinicianA))

    // 2. They correct it: the client never joined.
    state.params = { id: client.id, noteId: seeded.note.id }
    state.body = {
      content: 'Client did not join.',
      reason: 'Client did not join',
      attendanceStatus: 'no-show',
      signatureData: SIGNATURE,
    }
    await notePatch(makeEvent(clinicianA))

    // 3. A second session, signed and attended, so the total is not just zero.
    const second = await seedSession(prisma, { suffix: 'A2' })
    await prisma.client.update({
      where: { id: second.client.id },
      data: { clinicianUserId: clinicianA.id },
    })
    state.params = { id: second.clientUser.id }
    state.body = {
      content: 'Good session.',
      attendanceStatus: 'show',
      appointmentId: second.appointment.id,
      action: 'clinician-sign',
      clinicianSignatureData: SIGNATURE,
    }
    await notesPost(makeEvent(clinicianA))

    // 4. Export.
    state.params = { id: clinicianA.id }
    state.query = { from: '2026-11-01', to: '2026-11-30' }
    const csv = (await exportGet(makeEvent(clinicianA))) as string
    const lines = csv.trim().split('\r\n')
    const table = lines
      .slice(lines.findIndex((line) => line.startsWith('Date,')) + 1)
      .map((line) => line.split(','))

    // Columns: Date, Start, End, Scheduled, Counted, Attendance, Note status, Event, Current, ID, Supersedes
    const summary = table.map((c) => [c[4], c[5], c[7], c[8]])
    expect(summary).toEqual(
      expect.arrayContaining([
        ['60', 'show', 'SIGNED', 'no'],
        ['0', 'no-show', 'CORRECTED', 'yes'],
        ['60', 'show', 'SIGNED', 'yes'],
      ])
    )
    expect(table).toHaveLength(3)
    const corrected = table.find((c) => c[7] === 'CORRECTED')
    const original = table.find((c) => c[7] === 'SIGNED' && c[8] === 'no')
    expect(corrected?.[10]).toBe(original?.[9])
    expect(lines).toContain('Total counted hours,1')
    expect(lines).toContain('Counted sessions,1')
  })
})
