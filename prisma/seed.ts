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
        where: { alias: { in: ['ace_1', 'ace_2', 'ace_3', 'ace_4', 'ace_5', 'ace_6', 'ace_7', 'ace_8', 'ace_9', 'ace_10'] } },
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

  // Assign roles: alice@a.com and djanjanam@gmail.com = ADMIN, bob@b.com = CLIENT
  const adminEmails = ['alice@a.com', 'djanjanam@gmail.com']
  const clientEmail = 'bob@b.com'
  for (const email of adminEmails) {
    const user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      })
      console.log(`Set ${email} as ADMIN`)
    }
  }
  const clientUser = await prisma.user.findUnique({ where: { email: clientEmail } })
  if (clientUser) {
    await prisma.user.update({
      where: { id: clientUser.id },
      data: { role: 'CLIENT' },
    })
    console.log(`Set ${clientEmail} as CLIENT`)
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
