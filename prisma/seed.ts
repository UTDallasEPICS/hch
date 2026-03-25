import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'
import { joinName } from '../server/utils/name'
import {
  ensureDefaultDeclarationTemplates,
  backfillSessionNotesRequestTemplates,
} from '../server/utils/declaration-templates'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

/** Ensures Bob Builder has a Client row, canonical Note clientIds, and demo SessionNote rows. */
async function ensureBobBuilderSessionNotes(bobUserId: string) {
  let client = await prisma.client.findUnique({ where: { userId: bobUserId } })
  if (!client) {
    client = await prisma.client.create({
      data: { userId: bobUserId, status: 'ACTIVE' },
    })
    console.log('Created Client row for Bob Builder.')
  }

  // Legacy editor notes sometimes stored User.id in Note.clientId; profile expects Client.id (or user id via OR).
  const legacyNotes = await prisma.note.updateMany({
    where: { clientId: bobUserId },
    data: { clientId: client.id },
  })
  if (legacyNotes.count > 0) {
    console.log(`Re-linked ${legacyNotes.count} editor note(s) to Bob's Client id.`)
  }

  const existingSessionNotes = await prisma.sessionNote.count({
    where: { clientId: client.id },
  })
  if (existingSessionNotes > 0) {
    console.log(`Bob Builder already has ${existingSessionNotes} session note(s); skipping sample notes.`)
    return
  }

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
      {
        clientId: client.id,
        content:
          'Session 3 — Reviewed ACE and trauma-informed psychoeducation. Discussed grounding and window of tolerance. Bob reported mild increase in nightmares; agreed to track frequency. No change to risk status.',
      },
      {
        clientId: client.id,
        content:
          'Session 4 — PCL-5 scores discussed in context of treatment goals. Practiced breathing retraining. Plan to introduce written exposure hierarchy next visit pending Bob’s comfort.',
      },
    ],
  })
  console.log('Created 4 sample SessionNote rows for Bob Builder.')
}

async function main() {
  console.log('Start seeding...')

  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)
  console.log('Declaration templates ensured and session note requests backfilled.')

  const userNames: Record<string, { fname: string; lname: string }> = {
    'bob@b.com': { fname: 'Bob', lname: 'Builder' },
    'alice@a.com': { fname: 'Alice', lname: 'Wonderland' },
  }
  const adminEmails = ['alice@a.com', 'djanjanam@gmail.com']
  const clientEmail = 'bob@b.com'
  for (const email of adminEmails) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      const names = userNames[email]
      await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'ADMIN',
          ...(names ? { name: joinName(names.fname, names.lname) } : {}),
        },
      })
      console.log(`Set ${email} as ADMIN${names ? ` (${names.fname} ${names.lname})` : ''}`)
    }
  }
  const clientUser = await prisma.user.findUnique({ where: { email: clientEmail } })
  if (clientUser) {
    const names = userNames[clientEmail]
    await prisma.user.update({
      where: { id: clientUser.id },
      data: {
        role: 'CLIENT',
        ...(names ? { name: joinName(names.fname, names.lname) } : {}),
      },
    })
    console.log(`Set ${clientEmail} as CLIENT${names ? ` (${names.fname} ${names.lname})` : ''}`)
    await ensureBobBuilderSessionNotes(clientUser.id)
  } else {
    console.log(`Skip Bob session notes: no user with ${clientEmail}`)
  }

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
