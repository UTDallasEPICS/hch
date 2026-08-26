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

async function main() {
  console.log('Start seeding...')

  await ensureDefaultDeclarationTemplates(prisma)
  await backfillSessionNotesRequestTemplates(prisma)

  // Create / Upsert Alice (Admin)
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
