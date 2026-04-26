import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'
import {
  ensureDefaultDeclarationTemplates,
  backfillSessionNotesRequestTemplates,
} from '../server/utils/declaration-templates'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

async function ensureLatestGadForm(userId: string) {
  const existing = await prisma.gadForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existing) {
    return prisma.gadForm.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETE',
        totalScore: 12,
        severity: 'Moderate',
        submittedAt: new Date(),
      },
    })
  }

  return prisma.gadForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 12,
      severity: 'Moderate',
      submittedAt: new Date(),
    },
  })
}

async function ensureLatestPhqForm(userId: string) {
  const existing = await prisma.phqForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existing) {
    return prisma.phqForm.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETE',
        totalScore: 14,
        severity: 'Moderate depression',
        submittedAt: new Date(),
      },
    })
  }

  return prisma.phqForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 14,
      severity: 'Moderate depression',
      submittedAt: new Date(),
    },
  })
}

async function ensureLatestPclForm(userId: string) {
  const existing = await prisma.pclForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existing) {
    return prisma.pclForm.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETE',
        totalScore: 45,
        severity: 'Moderate',
        submittedAt: new Date(),
      },
    })
  }

  return prisma.pclForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 45,
      severity: 'Moderate',
      submittedAt: new Date(),
    },
  })
}

async function ensureLatestAceForm(userId: string) {
  const existing = await prisma.aceForm.findFirst({
    where: { userId },
    orderBy: { id: 'desc' },
  })

  if (existing) {
    return prisma.aceForm.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETE',
        totalScore: 2,
        severity: 'Low',
        submittedAt: new Date(),
      },
    })
  }

  return prisma.aceForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 2,
      severity: 'Low',
      submittedAt: new Date(),
    },
  })
}

async function seedForms(userId: string) {
  // 1. AppForm (Application)
  const appForm = await prisma.appForm.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: 'COMPLETE',
      submittedAt: new Date(),
    },
  })

  await prisma.appQuestion.upsert({
    where: { formId: appForm.id },
    update: {},
    create: {
      formId: appForm.id,
      userId,
      q01: 'Bob',
      q02: 'Builder',
      q05: '1234567890',
    },
  })

  // 2. GAD-7
  const gadForm = await ensureLatestGadForm(userId)

  await prisma.gadQuestion.upsert({
    where: { formId: gadForm.id },
    update: {
      userId,
      g01: 2,
      g02: 1,
      g03: 2,
      g04: 1,
      g05: 2,
      g06: 2,
      g07: 2,
      g08: 1,
    },
    create: {
      formId: gadForm.id,
      userId,
      g01: 2,
      g02: 1,
      g03: 2,
      g04: 1,
      g05: 2,
      g06: 2,
      g07: 2,
      g08: 1,
    },
  })

  // 3. PHQ-9
  const phqForm = await ensureLatestPhqForm(userId)

  await prisma.phqQuestion.upsert({
    where: { formId: phqForm.id },
    update: {
      userId,
      q1: 2,
      q2: 1,
      q3: 2,
      q4: 1,
      q5: 2,
      q6: 2,
      q7: 2,
      q8: 1,
      q9: 1,
      q10: 1,
    },
    create: {
      formId: phqForm.id,
      userId,
      q1: 2,
      q2: 1,
      q3: 2,
      q4: 1,
      q5: 2,
      q6: 2,
      q7: 2,
      q8: 1,
      q9: 1,
      q10: 1,
    },
  })

  // 4. PCL-5
  const pclForm = await ensureLatestPclForm(userId)

  await prisma.pclQuestion.upsert({
    where: { formId: pclForm.id },
    update: {
      userId,
      q01: 3,
      q02: 2,
      q03: 3,
      q04: 2,
      q05: 2,
      q06: 3,
      q07: 2,
      q08: 2,
      q09: 2,
      q10: 2,
      q11: 2,
      q12: 2,
      q13: 2,
      q14: 2,
      q15: 2,
      q16: 2,
      q17: 2,
      q18: 2,
      q19: 2,
      q20: 2,
    },
    create: {
      formId: pclForm.id,
      userId,
      q01: 3,
      q02: 2,
      q03: 3,
      q04: 2,
      q05: 2,
      q06: 3,
      q07: 2,
      q08: 2,
      q09: 2,
      q10: 2,
      q11: 2,
      q12: 2,
      q13: 2,
      q14: 2,
      q15: 2,
      q16: 2,
      q17: 2,
      q18: 2,
      q19: 2,
      q20: 2,
    },
  })

  // 5. ACE (Hardcoded Form)
  const aceForm = await ensureLatestAceForm(userId)

  await prisma.aceQuestion.upsert({
    where: { formId: aceForm.id },
    update: {
      userId,
      a01: 'Yes',
      a02: 'Yes',
      a03: 'No',
      a04: 'No',
      a05: 'No',
      a06: 'No',
      a07: 'No',
      a08: 'No',
      a09: 'No',
      a10: 'No',
    },
    create: {
      formId: aceForm.id,
      userId,
      a01: 'Yes',
      a02: 'Yes',
      a03: 'No',
      a04: 'No',
      a05: 'No',
      a06: 'No',
      a07: 'No',
      a08: 'No',
      a09: 'No',
      a10: 'No',
    },
  })
}

async function ensureBobBuilderSessionNotes(bobUserId: string, clinicianUserId: string) {
  const bobClient = await prisma.client.upsert({
    where: { userId: bobUserId },
    update: { status: 'ACTIVE', clinicianUserId },
    create: { userId: bobUserId, status: 'ACTIVE', clinicianUserId },
  })
  // Populate form dummy data if it doesn't exist
  const existingApp = await prisma.appForm.count({ where: { userId: bobUserId } })
  if (existingApp === 0) {
    await seedForms(bobUserId)
    console.log('Seeded clinical forms for Bob Builder.')
  }
  return bobClient
}

/**
 * Seed a representative note in each workflow state so the multi-tier approval
 * UI (draft / clinician-signed / fully-approved) has real data to exercise,
 * and across both kinds (progress vs psychotherapy).
 */
async function seedApprovalWorkflowNotes(
  clientId: string,
  clinicianUserId: string,
  adminUserId: string
) {
  const existing = await prisma.sessionNote.count({ where: { clientId } })
  if (existing > 0) {
    console.log('Session notes already exist; skipping approval-workflow seed.')
    return
  }

  const PLACEHOLDER_SIG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

  const now = new Date()

  // 1. DRAFT progress note – still being written.
  await prisma.sessionNote.create({
    data: {
      clientId,
      sessionName: 'Intake – initial session',
      sessionNumber: 1,
      kind: 'PROGRESS',
      status: 'DRAFT',
      content:
        'Client arrived on time. Presenting concerns include sleep disruption and work stress. Draft — still gathering history.',
      attended: true,
    },
  })

  // 2. CLINICIAN_SIGNED progress note – waiting for admin sign-off.
  const pendingNote = await prisma.sessionNote.create({
    data: {
      clientId,
      sessionName: 'Session 2 – CBT intro',
      sessionNumber: 2,
      kind: 'PROGRESS',
      status: 'CLINICIAN_SIGNED',
      content:
        'Reviewed sleep-hygiene worksheet. Client reports mild improvement. Introduced cognitive-restructuring framework.',
      attended: true,
      clinicianSignedAt: now,
      clinicianSignedById: clinicianUserId,
      clinicianSignatureData: PLACEHOLDER_SIG,
    },
  })
  await prisma.notification.create({
    data: {
      userId: adminUserId,
      type: 'NOTE_READY_FOR_APPROVAL',
      title: 'Note awaiting approval',
      message: 'Carl Karl signed a progress note for Bob Builder. Please review and countersign.',
      sessionNoteId: pendingNote.id,
    },
  })

  // 3. FULLY_APPROVED progress note.
  await prisma.sessionNote.create({
    data: {
      clientId,
      sessionName: 'Session 3 – thought records',
      sessionNumber: 3,
      kind: 'PROGRESS',
      status: 'FULLY_APPROVED',
      content:
        'Completed two thought-record examples in session. Client identified core belief patterns and committed to daily practice.',
      attended: true,
      clinicianSignedAt: now,
      clinicianSignedById: clinicianUserId,
      clinicianSignatureData: PLACEHOLDER_SIG,
      adminSignedAt: now,
      adminSignedById: adminUserId,
      adminSignatureData: PLACEHOLDER_SIG,
      adminApprovalNote: 'Reviewed — documentation meets clinic standard.',
    },
  })

  // 4. PSYCHOTHERAPY draft – separately stored per HIPAA.
  await prisma.sessionNote.create({
    data: {
      clientId,
      sessionName: 'Session 3 – clinician process notes',
      sessionNumber: 3,
      kind: 'PSYCHOTHERAPY',
      status: 'DRAFT',
      content:
        'Clinician-only process notes: countertransference observations, working hypotheses, and next-session targets.',
      attended: true,
    },
  })

  // 5. PSYCHOTHERAPY fully approved – demonstrates tier-2 sign-off on process notes.
  await prisma.sessionNote.create({
    data: {
      clientId,
      sessionName: 'Session 2 – clinician process notes',
      sessionNumber: 2,
      kind: 'PSYCHOTHERAPY',
      status: 'FULLY_APPROVED',
      content:
        'Process notes: explored defense patterns around perfectionism. Plan to revisit in session 4.',
      attended: true,
      clinicianSignedAt: now,
      clinicianSignedById: clinicianUserId,
      clinicianSignatureData: PLACEHOLDER_SIG,
      adminSignedAt: now,
      adminSignedById: adminUserId,
      adminSignatureData: PLACEHOLDER_SIG,
      adminApprovalNote: 'Approved — psychotherapy note retained separately.',
    },
  })

  console.log('Seeded 5 session notes across DRAFT / CLINICIAN_SIGNED / FULLY_APPROVED.')
}

async function main() {
  console.log('Start seeding...')

  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)

  // Create / Upsert Alice (Admin — default approver for the note workflow)
  const alice = await prisma.user.upsert({
    where: { email: 'alice@a.com' },
    update: { role: 'ADMIN', name: 'Alice Wonderland' },
    create: {
      id: 'alice_id',
      email: 'alice@a.com',
      name: 'Alice Wonderland',
      emailVerified: true,
      role: 'ADMIN',
    },
  })
  console.log('Seeded Admin: alice@a.com')

  // Create / Upsert Carl (Clinician)
  const carl = await prisma.user.upsert({
    where: { email: 'carl@c.com' },
    update: { role: 'CLINICIAN', name: 'Carl Karl' },
    create: {
      id: 'carl_id',
      email: 'carl@c.com',
      name: 'Carl Karl',
      emailVerified: true,
      role: 'CLINICIAN',
    },
  })
  console.log('Seeded Clinician: carl@c.com')

  // Create / Upsert Bob (Client)
  const bob = await prisma.user.upsert({
    where: { email: 'bob@b.com' },
    update: { role: 'CLIENT', name: 'Bob Builder' },
    create: {
      id: 'bob_id',
      email: 'bob@b.com',
      name: 'Bob Builder',
      emailVerified: true,
      role: 'CLIENT',
    },
  })
  console.log('Seeded Client: bob@b.com')

  const bobClient = await ensureBobBuilderSessionNotes(bob.id, carl.id)
  await seedApprovalWorkflowNotes(bobClient.id, carl.id, alice.id)

  console.log('Seeding finished.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
