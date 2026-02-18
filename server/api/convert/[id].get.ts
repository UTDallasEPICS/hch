/**
 * GET /api/convert/:id
 * Returns a DocumentUpload with its non-deleted ExtractedFields, sorted by fieldIndex.
 */

import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, message: 'Missing document id.' })

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

  return doc
})
