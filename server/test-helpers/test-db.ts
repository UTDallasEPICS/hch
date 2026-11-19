import Database from 'better-sqlite3'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../prisma/generated/client'

// Test-only helpers. Tests that use these run against the real migrations
// (including the session_log triggers), not a copy of the schema.

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url))

/** Applies every migration in prisma/migrations, in order. */
export function applyMigrations(db: Database.Database): void {
  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_/.test(name))
    .sort()
  for (const dir of dirs) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'))
  }
}

/** A Prisma client on a new, fully migrated SQLite file in a temp directory. */
export function createTestPrisma(): PrismaClient {
  const file = join(mkdtempSync(join(tmpdir(), 'hch-test-')), 'test.db')
  const raw = new Database(file)
  applyMigrations(raw)
  raw.close()
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) })
}

/**
 * One clinician, one client, and one past 60-minute appointment with its
 * placeholder note (DRAFT, attendance `show`), the same shape the app creates.
 */
export async function seedSession(prisma: PrismaClient, ids = { suffix: '1' }) {
  const s = ids.suffix
  const clinician = await prisma.user.create({
    data: {
      id: `clinician-${s}`,
      name: 'dana||lee',
      email: `dana${s}@example.test`,
      role: 'CLINICIAN',
    },
  })
  const clientUser = await prisma.user.create({
    data: { id: `client-${s}`, name: 'sam||rivera', email: `sam${s}@example.test`, role: 'CLIENT' },
  })
  const client = await prisma.client.create({
    data: { userId: clientUser.id, status: 'ACTIVE', clinicianUserId: clinician.id },
  })
  const appointment = await prisma.appointment.create({
    data: {
      clientId: clientUser.id,
      adminId: clinician.id,
      title: `Sam_Rivera_0${s}`,
      sessionName: `Sam_Rivera_0${s}`,
      sessionNumber: 1,
      startTime: new Date('2026-11-02T15:00:00.000Z'),
      endTime: new Date('2026-11-02T16:00:00.000Z'),
      recurrence: 'NONE',
    },
  })
  const note = await prisma.sessionNote.create({
    data: {
      clientId: client.id,
      appointmentId: appointment.id,
      sessionName: appointment.sessionName,
      sessionNumber: 1,
      content: '',
      attendanceStatus: 'show',
    },
  })
  return { clinician, clientUser, client, appointment, note }
}
