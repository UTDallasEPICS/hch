import { defineEventHandler, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { auth } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const noteId = Number(event.context.params?.noteId)

  const edits = await prisma.noteEdit.findMany({
    where: { noteId },
    orderBy: { editedAt: 'desc' },
    select: { editedAt: true, reason: true }
  })

  return edits
})