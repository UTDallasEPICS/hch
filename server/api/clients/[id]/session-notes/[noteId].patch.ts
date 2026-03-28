import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { auth } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'
import { isClinicalClient } from '../../../../utils/is-clinical-client'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  })
  if (!isAdmin(currentUser?.role ?? null, currentUser?.email ?? null)) {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const clientUserId = getRouterParam(event, 'id')
  const noteId = getRouterParam(event, 'noteId')
  if (!clientUserId || !noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or note id' })
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: clientUserId },
    select: { role: true, email: true },
  })
  if (!targetUser || !isClinicalClient(targetUser.role, targetUser.email)) {
    throw createError({ statusCode: 404, statusMessage: 'Session note not found' })
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
