import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'

function canEditOnOrAfterSessionDay(sessionStart: Date, now = new Date()) {
  const sessionDay = new Date(sessionStart)
  sessionDay.setHours(0, 0, 0, 0)
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return today >= sessionDay
}

function canMarkAttendanceOnOrAfterSessionStart(sessionStart: Date, now = new Date()) {
  return now >= sessionStart
}

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const body = await readBody<{
    content?: string
    attended?: boolean
    appointmentId?: string
    signatureData?: string
    /** Required when updating an existing note for this session (audit trail). */
    reason?: string
  }>(event)
  if (typeof body?.content !== 'string' || !body.content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body?.appointmentId || typeof body.appointmentId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'An appointment/session must be selected' })
  }
  if (!body?.signatureData || typeof body.signatureData !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Admin signature is required' })
  }
  if (
    !body.signatureData.startsWith('data:image/png;base64,') ||
    body.signatureData.length < 100
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature data format' })
  }
  const hasAttendance = typeof body.attended === 'boolean'

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId },
    })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: body.appointmentId, clientId: clientUserId },
    select: { id: true, sessionName: true, sessionNumber: true, startTime: true },
  })
  if (!appointment) {
    throw createError({ statusCode: 400, statusMessage: 'Selected appointment not found for client' })
  }
  if (!canEditOnOrAfterSessionDay(appointment.startTime)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Notes can only be edited on the session day or after the session has passed.',
    })
  }
  if (hasAttendance && !canMarkAttendanceOnOrAfterSessionStart(appointment.startTime)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Present/absent can only be marked on or after the session start time.',
    })
  }
  if (!hasAttendance) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Attendance status is required when saving a session note.',
    })
  }
  const attended = body.attended

  const existingNote = await prisma.sessionNote.findFirst({
    where: {
      appointmentId: appointment.id,
      clientId: client.id,
    },
    select: { id: true, content: true },
  })

  if (existingNote) {
    if (!body.reason?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A reason is required when updating an existing session note',
      })
    }

    const [, updated] = await prisma.$transaction([
      prisma.sessionNoteEdit.create({
        data: {
          sessionNoteId: existingNote.id,
          originalContent: existingNote.content,
          reason: body.reason.trim(),
          signature: body.signatureData,
        },
      }),
      prisma.sessionNote.update({
        where: { id: existingNote.id },
        data: {
          content: body.content.trim(),
          attended,
          signatureData: body.signatureData,
        },
      }),
    ])

    return updated
  }

  const note = await prisma.sessionNote.create({
    data: {
      clientId: client.id,
      content: body.content.trim(),
      attended,
      signatureData: body.signatureData,
      appointmentId: appointment.id,
      sessionName: appointment.sessionName,
      sessionNumber: appointment.sessionNumber,
    },
  })

  return note
})
