import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'

// Runs the real migrations on an in-memory SQLite DB, so these tests check the
// triggers that actually ship, not a copy of them.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url))

function migratedDb() {
  const db = new Database(':memory:')
  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d+_/.test(name))
    .sort()
  for (const dir of dirs) {
    db.exec(readFileSync(join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8'))
  }
  return db
}

type Db = ReturnType<typeof migratedDb>

function insertLogRow(
  db: Db,
  row: { id: string; sessionNoteId: string; supersedesId?: string | null }
) {
  db.prepare(
    `INSERT INTO session_log (
      id, event, sessionNoteId, clinicianUserId, clinicianName, clientUserId,
      sessionStart, sessionEnd, durationMinutes, countedMinutes,
      attendanceStatus, noteStatus, noteKind, supersedesId, recordedById
    ) VALUES (
      @id, 'SIGNED', @sessionNoteId, 'clinician-1', 'Dana Lee', 'client-1',
      '2026-11-02T15:00:00.000Z', '2026-11-02T16:00:00.000Z', 60, 60,
      'show', 'CLINICIAN_SIGNED', 'PROGRESS', @supersedesId, 'clinician-1'
    )`
  ).run({ supersedesId: null, ...row })
}

let db: Db

beforeEach(() => {
  db = migratedDb()
  insertLogRow(db, { id: 'row-1', sessionNoteId: 'note-1' })
})

describe('session_log is append-only', () => {
  it('rejects UPDATE', () => {
    expect(() => db.prepare(`UPDATE session_log SET countedMinutes = 0`).run()).toThrow(
      'session_log is append-only'
    )
  })

  it('rejects DELETE', () => {
    expect(() => db.prepare(`DELETE FROM session_log`).run()).toThrow('session_log is append-only')
  })

  it('has no foreign keys, so deleting a user, client, or appointment cannot cascade into it', () => {
    expect(db.prepare(`PRAGMA foreign_key_list(session_log)`).all()).toEqual([])
  })
})

describe('session_log_export is append-only', () => {
  beforeEach(() => {
    db.prepare(
      `INSERT INTO session_log_export (id, exportedById, clinicianUserId, rowCount)
       VALUES ('export-1', 'admin-1', 'clinician-1', 3)`
    ).run()
  })

  it('rejects UPDATE', () => {
    expect(() => db.prepare(`UPDATE session_log_export SET rowCount = 0`).run()).toThrow(
      'session_log_export is append-only'
    )
  })

  it('rejects DELETE', () => {
    expect(() => db.prepare(`DELETE FROM session_log_export`).run()).toThrow(
      'session_log_export is append-only'
    )
  })
})

describe("each note's rows form one chain", () => {
  it('accepts a correction that points at the latest row', () => {
    insertLogRow(db, { id: 'row-2', sessionNoteId: 'note-1', supersedesId: 'row-1' })
    insertLogRow(db, { id: 'row-3', sessionNoteId: 'note-1', supersedesId: 'row-2' })
    expect(db.prepare(`SELECT COUNT(*) AS n FROM session_log`).get()).toEqual({ n: 3 })
  })

  it('rejects a second first row for the same note', () => {
    expect(() => insertLogRow(db, { id: 'row-2', sessionNoteId: 'note-1' })).toThrow(
      'this note already has a first row'
    )
  })

  it('rejects superseding a row that was already superseded (a fork)', () => {
    insertLogRow(db, { id: 'row-2', sessionNoteId: 'note-1', supersedesId: 'row-1' })
    expect(() =>
      insertLogRow(db, { id: 'row-3', sessionNoteId: 'note-1', supersedesId: 'row-1' })
    ).toThrow(/UNIQUE constraint failed: session_log.supersedesId/)
  })

  it("rejects pointing at another note's row", () => {
    expect(() =>
      insertLogRow(db, { id: 'row-2', sessionNoteId: 'note-2', supersedesId: 'row-1' })
    ).toThrow('supersedesId must be a row of the same note')
  })
})
