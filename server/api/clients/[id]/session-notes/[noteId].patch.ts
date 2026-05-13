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
    attendanceStatus?: string
    signatureData?: string
  }>(event)

  if (!body?.content || typeof body.content !== 'string' || !body.content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body.reason?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Reason is required' })
  }

  const sig = body.signatureData?.trim() || body.signature?.trim() || ''

  const isBase64Png = sig.startsWith('data:image/png;base64,') && sig.length >= 100
  const isFontSignature = sig.startsWith('{') && sig.includes('"type":"font-signature"')

  if (!sig || (!isBase64Png && !isFontSignature)) {
    throw createError({ statusCode: 400, statusMessage: 'Signature is required' })
  }
  
  const signatureStored = sig

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
        editedContent: body.content.trim(),
        oldAttendanceStatus: note.attendanceStatus,
        newAttendanceStatus: body.attendanceStatus ?? note.attendanceStatus,
        reason: body.reason.trim(),
        signature: signatureStored,
      },
    }),
    prisma.sessionNote.update({
      where: { id: note.id },
      data: { content: body.content.trim(), 
        ...(body.attendanceStatus && { attendanceStatus: body.attendanceStatus }),
      },
    }),
  ])

  return updated
})
