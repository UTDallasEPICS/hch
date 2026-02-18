import { prisma } from '../../../utils/prisma'

interface FieldBody {
  fieldIndex: number
  label: string
  type: string
  options?: string[] | null
  pageNumber?: number | null
  confidence?: string
  isDeleted?: boolean
}

interface SaveBody {
  title: string
  slug: string
  description?: string
  fields: FieldBody[]
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  const body = await readBody<SaveBody>(event)
  if (!body?.title || !body?.slug) {
    throw createError({ statusCode: 400, message: '`title` and `slug` are required.' })
  }
  if (!Array.isArray(body.fields) || body.fields.length === 0) {
    throw createError({ statusCode: 400, message: '`fields` array is required and must not be empty.' })
  }

  const slug = body.slug.trim().toLowerCase().replace(/\s+/g, '-')

  const doc = await prisma.documentUpload.findUnique({ where: { id } })
  if (!doc) throw createError({ statusCode: 404, message: 'Document not found.' })
  if (doc.status === 'saved') {
    throw createError({ statusCode: 409, message: 'This document has already been saved as a form.' })
  }

  const activeFields = body.fields.filter((f) => !f.isDeleted && f.label.trim())

  const createdQuestions = await Promise.all(
    activeFields.map((f) =>
      prisma.question.create({
        data: {
          text: f.label.trim(),
          type: f.type,
          alias: `${slug}_${f.fieldIndex}_${f.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .slice(0, 30)}`,
        },
      })
    )
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
