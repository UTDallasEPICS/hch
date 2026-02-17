import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, message: 'Missing form slug' })
  }

  const form = await prisma.form.findUnique({
    where: { slug },
    include: {
      formQuestions: {
        orderBy: { order: 'asc' },
        include: { question: true },
      },
    },
  })

  if (!form) {
    throw createError({ statusCode: 404, message: 'Form not found' })
  }

  return {
    id: form.id,
    title: form.title,
    description: form.description,
    slug: form.slug,
    questions: form.formQuestions.map((fq) => ({
      id: fq.question.id,
      text: fq.question.text,
      type: fq.question.type,
      alias: fq.question.alias,
      options: fq.question.options ? (JSON.parse(fq.question.options) as string[]) : undefined,
      order: fq.order,
    })),
  }
})
