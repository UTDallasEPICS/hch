import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

  const doc = await prisma.documentUpload.findUnique({
    where: { id },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sourceUrl: true,
      status: true,
      errorMessage: true,
    },
  })

  if (!doc) throw createError({ statusCode: 404, message: 'Document not found.' })

  return doc
})
