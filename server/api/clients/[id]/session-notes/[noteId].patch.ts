import { requireAdmin } from '../../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'

export default defineEventHandler(async (event) => {

  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  const noteId = getRouterParam(event, 'noteId')
  if (!clientUserId || !noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or note id' })
  }

  const body = await readBody<{
    content?: string
    reason?: string
    signature?: string
  }>(event)

  if (!body?.content || typeof body.content !== 'string' || !body.content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body.reason?.trim() || !body.signature?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reason and signature are required' })
  }

  const note = await prisma.sessionNote.findFirst({
    where: {
      id: noteId,
      client: { userId: clientUserId },
    },
  })

  if (!note) {
    throw createError({ statusCode: 404, statusMessage: 'Session note not found' })
  }

  await prisma.sessionNoteEdit.create({
    data: {
      sessionNoteId: note.id,
      originalContent: note.content,
      reason: body.reason.trim(),
      signature: body.signature.trim(),
    },
  })

  const updated = await prisma.sessionNote.update({
    where: { id: note.id },
    data: { content: body.content.trim() },
  })

  return updated
})
