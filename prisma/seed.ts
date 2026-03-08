import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Start seeding...')

  // ACE form: Form table only (questions in front-end; AceResponse for answers)
  // Remove any stale FormQuestion/Question records from when ACE used the DB
  const aceForm = await prisma.form.findUnique({ where: { slug: 'ace-form' } })
  if (aceForm) {
    const deleted = await prisma.formQuestion.deleteMany({
      where: { formId: aceForm.id },
    })
    if (deleted.count > 0) {
      await prisma.question.deleteMany({
        where: {
          alias: {
            in: [
              'ace_1',
              'ace_2',
              'ace_3',
              'ace_4',
              'ace_5',
              'ace_6',
              'ace_7',
              'ace_8',
              'ace_9',
              'ace_10',
            ],
          },
        },
      })
      console.log('Removed old ACE questions from DB (now in front-end)')
    }
  } else {
    await prisma.form.create({
      data: {
        title: 'ACE Questionnaire',
        description:
          'Adverse Childhood Experiences (ACE) Questionnaire. Answer Yes or No for each question.',
        slug: 'ace-form',
      },
    })
    console.log('Created ACE form (questions in front-end)')
  }

  // Ensure baseline users always exist after a reset.
  await prisma.user.upsert({
    where: { email: 'alice@a.com' },
    update: {
      name: 'Alice',
      role: 'ADMIN',
    },
    create: {
      id: 'seed-alice',
      name: 'Alice',
      email: 'alice@a.com',
      role: 'ADMIN',
    },
  })
  console.log('Ensured alice@a.com exists as ADMIN')

  await prisma.user.upsert({
    where: { email: 'bob@b.com' },
    update: {
      name: 'Bob',
      role: 'CLIENT',
    },
    create: {
      id: 'seed-bob',
      name: 'Bob',
      email: 'bob@b.com',
      role: 'CLIENT',
    },
  })
  console.log('Ensured bob@b.com exists as CLIENT')

  // Keep existing admin aliases consistent if they already exist.
  const adminAliases = ['alice@example.com', 'djanjanam@gmail.com']
  for (const email of adminAliases) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) continue
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
    })
    console.log(`Set ${email} as ADMIN`)
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
