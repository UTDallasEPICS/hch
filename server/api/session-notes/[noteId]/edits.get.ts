import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'

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

  const noteId = getRouterParam(event, 'noteId')
  if (!noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing note id' })
  }

  const edits = await prisma.sessionNoteEdit.findMany({
    where: { sessionNoteId: noteId },
    orderBy: { editedAt: 'desc' },
    select: { editedAt: true, reason: true },
  })

  return edits.map((e) => ({
    editedAt: e.editedAt.toISOString(),
    reason: e.reason ?? '',
  }))
})
