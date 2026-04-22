import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getHeaders, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'

export default defineEventHandler(async (event) => {

  const user = requireStaff(event)

  const noteId = getRouterParam(event, 'noteId')
  if (!noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing note id' })
  }

  const sessionNote = await prisma.sessionNote.findUnique({
    where: { id: noteId },
    select: { client: { select: { userId: true } } },
  })
  if (sessionNote?.client?.userId) {
    await assertStaffCanAccessClient(event, sessionNote.client.userId)
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
