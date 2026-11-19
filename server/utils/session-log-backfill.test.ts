import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestPrisma, seedSession } from '../test-helpers/test-db'
import { backfillSessionLog } from './session-log'

const prisma = createTestPrisma()
let signedNoteId = ''
let legacyNoteId = ''

beforeAll(async () => {
  const signed = await seedSession(prisma, { suffix: 'signed' })
  await prisma.sessionNote.update({
    where: { id: signed.note.id },
    data: { status: 'FULLY_APPROVED', clinicianSignedById: signed.clinician.id },
  })
  signedNoteId = signed.note.id

  // Signed through the old single-signature flow: no clinicianSignedById.
  const legacy = await seedSession(prisma, { suffix: 'legacy' })
  await prisma.sessionNote.update({
    where: { id: legacy.note.id },
    data: { status: 'CLINICIAN_SIGNED', signatureData: '{"type":"font-signature"}' },
  })
  legacyNoteId = legacy.note.id

  // Placeholder draft: never logged.
  await seedSession(prisma, { suffix: 'draft' })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('backfillSessionLog', () => {
  it('previews without writing on a dry run', async () => {
    const result = await backfillSessionLog(prisma, { recordedById: 'admin-1', dryRun: true })

    expect(result).toEqual({
      dryRun: true,
      signedNotes: 2,
      alreadyLogged: 0,
      created: 1,
      unresolved: [{ sessionNoteId: legacyNoteId, reason: 'NO_SIGNER' }],
    })
    expect(await prisma.sessionLog.count()).toBe(0)
  })

  it('writes one BACKFILL row per resolvable signed note and reports the rest', async () => {
    const result = await backfillSessionLog(prisma, { recordedById: 'admin-1' })

    expect(result).toMatchObject({ dryRun: false, created: 1, alreadyLogged: 0 })
    expect(result.unresolved).toEqual([{ sessionNoteId: legacyNoteId, reason: 'NO_SIGNER' }])

    const rows = await prisma.sessionLog.findMany()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      event: 'BACKFILL',
      sessionNoteId: signedNoteId,
      noteStatus: 'FULLY_APPROVED',
      countedMinutes: 60,
      recordedById: 'admin-1',
    })
  })

  it('creates nothing when run a second time', async () => {
    const result = await backfillSessionLog(prisma, { recordedById: 'admin-1' })

    expect(result).toMatchObject({ created: 0, alreadyLogged: 1 })
    expect(await prisma.sessionLog.count()).toBe(1)
  })
})
