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
  const gadForm = await prisma.gadForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 12,
      severity: 'Moderate',
      submittedAt: new Date(),
    },
  })

  await prisma.gadQuestion.create({
    data: {
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
  const phqForm = await prisma.phqForm.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: 'COMPLETE',
      totalScore: 14,
      severity: 'Moderate depression',
      submittedAt: new Date(),
    },
  })

  await prisma.phqQuestion.upsert({
    where: { formId: phqForm.id },
    update: {},
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
  const pclForm = await prisma.pclForm.create({
    data: {
      userId,
      status: 'COMPLETE',
      totalScore: 45,
      severity: 'Moderate',
      submittedAt: new Date(),
    },
  })

  await prisma.pclQuestion.create({
    data: {
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
  const aceForm = await prisma.aceForm.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      status: 'COMPLETE',
      totalScore: 2,
      severity: 'Low',
      submittedAt: new Date(),
    },
  })

  await prisma.aceQuestion.upsert({
    where: { formId: aceForm.id },
    update: {},
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

async function ensureBobBuilderSessionNotes(bobUserId: string) {
  const client = await prisma.client.upsert({
    where: { userId: bobUserId },
    update: { status: 'ACTIVE' },
    create: { userId: bobUserId, status: 'ACTIVE' },
  })

  const existingSessionNotes = await prisma.sessionNote.count({
    where: { clientId: client.id },
  })

  if (existingSessionNotes === 0) {
    await prisma.sessionNote.createMany({
      data: [
        {
          clientId: client.id,
          content:
            'Intake / Week 1 — Rapport established. Bob reviewed clinic policies and confidentiality. Reported primary stressors related to work deadlines and sleep disruption. PHQ-9 and GAD-7 administered; safety screen negative. Plan: sleep hygiene handout, begin weekly CBT skills.',
        },
        {
          clientId: client.id,
          content:
            'Session 2 — Focus on thought challenging around catastrophic predictions at work. Homework: thought record for 3 situations. Bob engaged well; identified one automatic thought pattern to monitor between sessions.',
        },
      ],
    })
    console.log('Created sample SessionNote rows for Bob Builder.')
  }

  // Populate form dummy data if it doesn't exist
  const existingApp = await prisma.appForm.count({ where: { userId: bobUserId } })
  if (existingApp === 0) {
    await seedForms(bobUserId)
    console.log('Seeded clinical forms for Bob Builder.')
  }
}

async function main() {
  console.log('Start seeding...')

  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)

  // Create / Upsert Alice (Admin)
  await prisma.user.upsert({
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

  const newAdmins = [
    { email: 'cxk230036@utdallas.edu', name: 'Charvisree Koripella ', id: 'charvisree_id' },
    { email: 'dxj230013@utdallas.edu', name: 'Deethya Janjanam', id: 'deethya_id' },
    { email: 'dxv230030@utdallas.edu', name: 'Devika Viju', id: 'devika_id' },
    { email: 'rxa230079@utdallas.edu', name: 'Ritikha Ashok', id: 'ritikha_id' },
    { email: 'sxr230101@utdallas.edu', name: 'Swaminathan Ramanathan', id: 'swaminathan_id' },
    { email: 'tmw220003@utdallas.edu', name: 'Tushar Wani', id: 'tushar_id' },
    { email: 'info@hopecopeheal.org', name: 'Adriana Lewin', id: 'adriana_id' },
  ]

  for (const admin of newAdmins) {
    await prisma.user.upsert({
      where: { email: admin.email },
      update: { role: 'ADMIN', name: admin.name },
      create: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        emailVerified: true,
        role: 'ADMIN',
      },
    })
    console.log(`Seeded Admin: ${admin.email}`)
  }

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

  await ensureBobBuilderSessionNotes(bob.id)

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

