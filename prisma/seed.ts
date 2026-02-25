import 'dotenv/config'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from './generated/client'

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: connectionString })
const prisma = new PrismaClient({ adapter })

const ACE_QUESTIONS = [
  'Did a parent or other adult in the household often swear at you, insult you, put you down, or humiliate you?',
  'Did a parent or other adult in the household often push, grab, slap, or throw something at you?',
  'Did an adult or person at least 5 years older ever touch or fondle you or have you touch their body in a sexual way?',
  'Did you often feel that no one in your family loved you or thought you were important or special?',
  "Did you often feel that you didn't have enough to eat, had to wear dirty clothes, and had no one to protect you?",
  'Were your parents ever separated or divorced?',
  'Was your mother or stepmother often pushed, grabbed, slapped, or had something thrown at her?',
  'Did you live with anyone who was a problem drinker or alcoholic or who used street drugs?',
  'Was a household member depressed or mentally ill, or did a household member attempt suicide?',
  'Did a household member go to prison?',
]

async function main() {
  console.log('Start seeding...')

  // Create ACE form and questions (idempotent: skip if already present)
  let form = await prisma.form.findUnique({ where: { slug: 'ace-form' } })
  if (!form) {
    form = await prisma.form.create({
      data: {
        title: 'ACE Questionnaire',
        description:
          'Adverse Childhood Experiences (ACE) Questionnaire. Answer Yes or No for each question.',
        slug: 'ace-form',
      },
    })
    console.log('Created ACE form:', form.id)
  }

  for (let i = 0; i < ACE_QUESTIONS.length; i++) {
    const alias = `ace_${i + 1}`

    const question = await prisma.question.upsert({
      where: { alias },
      update: {
        text: ACE_QUESTIONS[i],
        type: 'radio',
      },
      create: {
        text: ACE_QUESTIONS[i],
        type: 'radio',
        alias,
      },
    })

    await prisma.formQuestion.upsert({
      where: {
        formId_questionId: {
          formId: form.id,
          questionId: question.id,
        },
      },
      update: {
        order: i + 1,
      },
      create: {
        formId: form.id,
        questionId: question.id,
        order: i + 1,
      },
    })
  }

  console.log('Ensured ACE form, questions, and question-order links')

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
