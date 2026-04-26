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

async function seedForms(userId: string) {
  // 1. AppForm (Application)
  const appForm = await prisma.appForm.upsert({
    where: { userId },
    update: { status: 'COMPLETE', submittedAt: new Date() },
    create: { userId, status: 'COMPLETE', submittedAt: new Date() },
  })

  await prisma.appQuestion.upsert({
    where: { formId: appForm.id },
    update: {
      q01: 'wendy.builder@example.com',
      q02: 'Wendy',
      q03: 'Builder',
      q04: '4165551234',
      q05: 'Female',
      q06: '1975-03-10',
      q07: '123 Construction Ave|||Toronto|||ON|||M5H 2N2',
      q08: 'Bob',
      q09: 'Builder',
      q10: '2010-06-15',
      q11: 'Male',
      q12: '123 Construction Ave|||Toronto|||ON|||M5H 2N2',
      q13: 'Acute Lymphoblastic Leukemia (ALL)',
      q14: '2024-01-10',
      q15: JSON.stringify([
        { firstName: 'Scoop', middleInitial: '', lastName: 'Builder', age: '10', relationship: 'Sibling' },
      ]),
      q16: JSON.stringify({ value: 'no', text: '' }),
      q17: JSON.stringify({ values: ['joint'], other: '' }),
      q18: 'yes',
      q19: 'Wendy',
      q20: 'Builder',
      q21: '123 Construction Ave',
      q22: 'Toronto',
      q23: 'ON',
      q24: 'M5H 2N2',
      q25: 'wendy@bobthebuilder.com',
      q26: 'Contractor',
      q27: 'yes',
      q28: 'Robert',
      q29: 'Builder',
      q30: '123 Construction Ave',
      q31: 'Toronto',
      q32: 'ON',
      q33: 'M5H 2N2',
      q34: 'robert@bobthebuilder.com',
      q35: 'Construction Manager',
      q36: JSON.stringify({ value: 'Mom', text: '' }),
      q37: 'yes',
      q38: 'yes',
      q39: 'Wendy Builder (Mother)',
      q40: 'Wendy Builder and Robert Builder',
      q41: '6 months',
      q42: 'no',
      q43: '2 weeks initial admission, multiple shorter stays',
      q44: 'no',
      q45: JSON.stringify({ value: 'no', text: '' }),
      q46: 'yes',
      q47: JSON.stringify(['adolescent_child_diagnosed_with_cancer']),
      q48: JSON.stringify({ firstName: 'Bob', middleInitial: '', lastName: 'Builder', age: '14', relationship: 'Self (Patient)' }),
      q49: 'need_referral',
      q50: 'yes_with_mental_health_benefits',
    },
    create: {
      formId: appForm.id,
      userId,
      q01: 'wendy.builder@example.com',
      q02: 'Wendy',
      q03: 'Builder',
      q04: '4165551234',
      q05: 'Female',
      q06: '1975-03-10',
      q07: '123 Construction Ave|||Toronto|||ON|||M5H 2N2',
      q08: 'Bob',
      q09: 'Builder',
      q10: '2010-06-15',
      q11: 'Male',
      q12: '123 Construction Ave|||Toronto|||ON|||M5H 2N2',
      q13: 'Acute Lymphoblastic Leukemia (ALL)',
      q14: '2024-01-10',
      q15: JSON.stringify([
        { firstName: 'Scoop', middleInitial: '', lastName: 'Builder', age: '10', relationship: 'Sibling' },
      ]),
      q16: JSON.stringify({ value: 'no', text: '' }),
      q17: JSON.stringify({ values: ['joint'], other: '' }),
      q18: 'yes',
      q19: 'Wendy',
      q20: 'Builder',
      q21: '123 Construction Ave',
      q22: 'Toronto',
      q23: 'ON',
      q24: 'M5H 2N2',
      q25: 'wendy@bobthebuilder.com',
      q26: 'Contractor',
      q27: 'yes',
      q28: 'Robert',
      q29: 'Builder',
      q30: '123 Construction Ave',
      q31: 'Toronto',
      q32: 'ON',
      q33: 'M5H 2N2',
      q34: 'robert@bobthebuilder.com',
      q35: 'Construction Manager',
      q36: JSON.stringify({ value: 'Mom', text: '' }),
      q37: 'yes',
      q38: 'yes',
      q39: 'Wendy Builder (Mother)',
      q40: 'Wendy Builder and Robert Builder',
      q41: '6 months',
      q42: 'no',
      q43: '2 weeks initial admission, multiple shorter stays',
      q44: 'no',
      q45: JSON.stringify({ value: 'no', text: '' }),
      q46: 'yes',
      q47: JSON.stringify(['adolescent_child_diagnosed_with_cancer']),
      q48: JSON.stringify({ firstName: 'Bob', middleInitial: '', lastName: 'Builder', age: '14', relationship: 'Self (Patient)' }),
      q49: 'need_referral',
      q50: 'yes_with_mental_health_benefits',
    },
  })

  // 2. GAD-7
  const gadForm = await prisma.gadForm.create({
    data: { userId, status: 'COMPLETE', totalScore: 12, severity: 'Moderate', submittedAt: new Date() },
  })
  await prisma.gadQuestion.create({
    data: { formId: gadForm.id, userId, g01: 2, g02: 1, g03: 2, g04: 1, g05: 2, g06: 2, g07: 2, g08: 1 },
  })

  // 3. PHQ-9
  const phqForm = await prisma.phqForm.create({
    data: { userId, status: 'COMPLETE', totalScore: 14, severity: 'Moderate depression', submittedAt: new Date() },
  })
  await prisma.phqQuestion.create({
    data: { formId: phqForm.id, userId, q1: 2, q2: 1, q3: 2, q4: 1, q5: 2, q6: 2, q7: 2, q8: 1, q9: 1, q10: 1 },
  })

  // 4. PCL-5
  const pclForm = await prisma.pclForm.create({
    data: { userId, status: 'COMPLETE', totalScore: 45, severity: 'Moderate', submittedAt: new Date() },
  })
  await prisma.pclQuestion.create({
    data: {
      formId: pclForm.id, userId,
      q01: 3, q02: 2, q03: 3, q04: 2, q05: 2, q06: 3, q07: 2, q08: 2, q09: 2, q10: 2,
      q11: 2, q12: 2, q13: 2, q14: 2, q15: 2, q16: 2, q17: 2, q18: 2, q19: 2, q20: 2,
    },
  })

  // 5. ACE
  const aceForm = await prisma.aceForm.create({
    data: { userId, status: 'COMPLETE', totalScore: 2, severity: 'Low', submittedAt: new Date() },
  })
  await prisma.aceQuestion.create({
    data: {
      formId: aceForm.id, userId,
      a01: 'Yes', a02: 'No', a03: 'No', a04: 'Yes', a05: 'Yes',
      a06: 'Yes', a07: 'No', a08: 'Yes', a09: 'No', a10: 'No',
    },
  })
}

async function ensureBobBuilderSessionNotes(bobUserId: string, clinicianUserId: string) {
  const bobClient = await prisma.client.upsert({
    where: { userId: bobUserId },
    update: { status: 'ACTIVE', clinicianUserId },
    create: { userId: bobUserId, status: 'ACTIVE', clinicianUserId },
  })

  const existingApp = await prisma.appForm.count({ where: { userId: bobUserId } })
  if (existingApp === 0) {
    await seedForms(bobUserId)
    console.log('Seeded clinical forms for Bob Builder.')
  }

  return bobClient
}

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

  await prisma.sessionNote.create({
    data: {
      clientId, sessionName: 'Intake – initial session', sessionNumber: 1,
      kind: 'PROGRESS', status: 'DRAFT',
      content: 'Client arrived on time. Presenting concerns include sleep disruption and work stress. Draft — still gathering history.',
      attended: true,
    },
  })

  const pendingNote = await prisma.sessionNote.create({
    data: {
      clientId, sessionName: 'Session 2 – CBT intro', sessionNumber: 2,
      kind: 'PROGRESS', status: 'CLINICIAN_SIGNED',
      content: 'Reviewed sleep-hygiene worksheet. Client reports mild improvement. Introduced cognitive-restructuring framework.',
      attended: true,
      clinicianSignedAt: now, clinicianSignedById: clinicianUserId, clinicianSignatureData: PLACEHOLDER_SIG,
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

  await prisma.sessionNote.create({
    data: {
      clientId, sessionName: 'Session 3 – thought records', sessionNumber: 3,
      kind: 'PROGRESS', status: 'FULLY_APPROVED',
      content: 'Completed two thought-record examples in session. Client identified core belief patterns and committed to daily practice.',
      attended: true,
      clinicianSignedAt: now, clinicianSignedById: clinicianUserId, clinicianSignatureData: PLACEHOLDER_SIG,
      adminSignedAt: now, adminSignedById: adminUserId, adminSignatureData: PLACEHOLDER_SIG,
      adminApprovalNote: 'Reviewed — documentation meets clinic standard.',
    },
  })

  await prisma.sessionNote.create({
    data: {
      clientId, sessionName: 'Session 3 – clinician process notes', sessionNumber: 3,
      kind: 'PSYCHOTHERAPY', status: 'DRAFT',
      content: 'Clinician-only process notes: countertransference observations, working hypotheses, and next-session targets.',
      attended: true,
    },
  })

  await prisma.sessionNote.create({
    data: {
      clientId, sessionName: 'Session 2 – clinician process notes', sessionNumber: 2,
      kind: 'PSYCHOTHERAPY', status: 'FULLY_APPROVED',
      content: 'Process notes: explored defense patterns around perfectionism. Plan to revisit in session 4.',
      attended: true,
      clinicianSignedAt: now, clinicianSignedById: clinicianUserId, clinicianSignatureData: PLACEHOLDER_SIG,
      adminSignedAt: now, adminSignedById: adminUserId, adminSignatureData: PLACEHOLDER_SIG,
      adminApprovalNote: 'Approved — psychotherapy note retained separately.',
    },
  })

  console.log('Seeded 5 session notes across DRAFT / CLINICIAN_SIGNED / FULLY_APPROVED.')
}

async function main() {
  console.log('Start seeding...')

  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)

  const alice = await prisma.user.upsert({
    where: { email: 'alice@a.com' },
    update: { role: 'ADMIN', name: 'Alice Wonderland' },
    create: { id: 'alice_id', email: 'alice@a.com', name: 'Alice Wonderland', emailVerified: true, role: 'ADMIN' },
  })
  console.log('Seeded Admin: alice@a.com')

  const carl = await prisma.user.upsert({
    where: { email: 'carl@c.com' },
    update: { role: 'CLINICIAN', name: 'Carl Karl' },
    create: { id: 'carl_id', email: 'carl@c.com', name: 'Carl Karl', emailVerified: true, role: 'CLINICIAN' },
  })
  console.log('Seeded Clinician: carl@c.com')

  const bob = await prisma.user.upsert({
    where: { email: 'bob@b.com' },
    update: { role: 'CLIENT', name: 'Bob Builder' },
    create: { id: 'bob_id', email: 'bob@b.com', name: 'Bob Builder', emailVerified: true, role: 'CLIENT' },
  })
  console.log('Seeded Client: bob@b.com')

  const bobClient = await ensureBobBuilderSessionNotes(bob.id, carl.id)
  await seedApprovalWorkflowNotes(bobClient.id, carl.id, alice.id)

  console.log('Seeding finished.')
}

main()
  .then(async () => { await prisma.$disconnect() })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })