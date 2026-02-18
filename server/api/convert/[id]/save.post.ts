import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  const body = await readBody<{ title: string; description?: string; slug: string }>(event)
  if (!body?.title || !body?.slug) {
    throw createError({ statusCode: 400, message: '`title` and `slug` are required.' })
  }

  const slug = body.slug.trim().toLowerCase().replace(/\s+/g, '-')

  const doc = await prisma.documentUpload.findUnique({
    where: { id },
    include: {
      extractedFields: {
        where: { isDeleted: false },
        orderBy: { fieldIndex: 'asc' },
      },
    },
  })

  if (!doc) throw createError({ statusCode: 404, message: 'Document not found.' })
  if (doc.status === 'saved') {
    throw createError({ statusCode: 409, message: 'This document has already been saved as a form.' })
  }

  const questionData = doc.extractedFields.map((f) => ({
    text: f.label,
    type: f.type,
    alias: `${slug}_${f.fieldIndex}_${f.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 30)}`,
  }))

  const createdQuestions = await Promise.all(
    questionData.map((q) => prisma.question.create({ data: q }))
  )

  const form = await prisma.form.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      slug,
      formQuestions: {
        create: createdQuestions.map((q, idx) => ({
          questionId: q.id,
          order: idx + 1,
        })),
      },
    },
    include: {
      formQuestions: { orderBy: { order: 'asc' }, include: { question: true } },
    },
  })

  await prisma.documentUpload.update({
    where: { id },
    data: { status: 'saved', savedFormId: form.id },
  })

  return { formId: form.id, slug: form.slug }
})
