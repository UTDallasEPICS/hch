import { prisma } from '../../utils/prisma'

export default defineEventHandler(async () => {
  const forms = await prisma.form.findMany({
    include: {
      formQuestions: {
        orderBy: { order: 'asc' },
        include: { question: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return forms.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    slug: f.slug,
    questionCount: f.formQuestions.length,
    questions: f.formQuestions.map((fq) => ({
      id: fq.question.id,
      text: fq.question.text,
      type: fq.question.type,
      alias: fq.question.alias,
      options: fq.question.options ? (JSON.parse(fq.question.options) as string[]) : undefined,
      order: fq.order,
    })),
  }))
})
