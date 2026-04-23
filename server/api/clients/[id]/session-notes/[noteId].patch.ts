import { requireStaff } from '../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../utils/clinician-access'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { isAdmin } from '../../../../utils/is-admin'

function canEditOnOrAfterSessionDay(sessionStart: Date, now = new Date()) {
  const sessionDay = new Date(sessionStart)
  sessionDay.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return today >= sessionDay
}

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  const noteId = getRouterParam(event, 'noteId')
  if (!clientUserId || !noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or note id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{
    content?: string
    reason?: string
    signature?: string
    signatureData?: string
  }>(event)

  if (!body?.content || typeof body.content !== 'string' || !body.content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body.reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reason is required' })
  }

  const signatureFromData =
    typeof body.signatureData === 'string' && body.signatureData.startsWith('data:image/png;base64,')
      ? body.signatureData.trim()
      : ''
  const signatureText =
    typeof body.signature === 'string' && body.signature.trim() ? body.signature.trim() : ''
  const signatureStored = signatureFromData || signatureText

  if (!signatureStored) {
    throw createError({ statusCode: 400, statusMessage: 'Signature is required' })
  }
  if (signatureFromData && signatureFromData.length < 100) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature data format' })
  }

  const note = await prisma.sessionNote.findFirst({
    where: {
      id: noteId,
      client: { userId: clientUserId },
    },
    include: {
      appointment: {
        select: { startTime: true },
      },
    },
  })

  if (!note) {
    throw createError({ statusCode: 404, statusMessage: 'Session note not found' })
  }
  if (note.appointment?.startTime && !canEditOnOrAfterSessionDay(note.appointment.startTime)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notes can only be edited on the session day or after the session has passed.',
    })
  }

  const [updated] = await prisma.$transaction([
    prisma.sessionNoteEdit.create({
      data: {
        sessionNoteId: note.id,
        originalContent: note.content,
        reason: body.reason.trim(),
        signature: signatureStored,
      },
    }),
    prisma.sessionNote.update({
      where: { id: note.id },
      data: { content: body.content.trim() },
    }),
  ])

  return updated
})
