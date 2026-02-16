import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { title, description, slug, questionIds } = body as {
    title?: string
    description?: string
    slug?: string
    questionIds?: string[]
  }

  if (!title || !slug) {
    throw createError({ statusCode: 400, message: 'title and slug are required' })
  }

  const form = await prisma.form.create({
    data: {
      title,
      description: description || null,
      slug: slug.trim().toLowerCase().replace(/\s+/g, '-'),
      formQuestions:
        Array.isArray(questionIds) && questionIds.length > 0
          ? {
              create: questionIds.map((id, index) => ({
                questionId: id,
                order: index + 1,
              })),
            }
          : undefined,
    },
    include: {
      formQuestions: { orderBy: { order: 'asc' }, include: { question: true } },
    },
  })

  return form
})
