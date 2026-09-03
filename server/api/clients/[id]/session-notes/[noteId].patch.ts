import { requireStaff } from '../../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { notifyAdmins } from '../../../../utils/notifications'
import { formatStoredUserNameForDisplay } from '../../../../utils/name'

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
      client: {
        select: { user: { select: { name: true } } },
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

  const newContent = body.content.trim()
  const contentChanged = newContent !== note.content
  const willUpdateAttendance =
    !!body.attendanceStatus && body.attendanceStatus !== note.attendanceStatus

  // Editing a note that was already clinician-signed or fully approved invalidates
  // every prior sign-off: the stored signatures no longer correspond to the current
  // content. Re-sign as the clinician with the freshly-captured signature, clear the
  // admin counter-sign, and send the note back through the approval queue so an admin
  // never appears to have approved content they did not see. Mirrors notes.post.ts. (#88)
  const wasSignedOrApproved = note.status === 'CLINICIAN_SIGNED' || note.status === 'FULLY_APPROVED'
  const resignAndResetApproval = wasSignedOrApproved && (contentChanged || willUpdateAttendance)

  const [, updated] = await prisma.$transaction([
    prisma.sessionNoteEdit.create({
      data: {
        sessionNoteId: note.id,
        originalContent: note.content,
        editedContent: newContent,
        oldAttendanceStatus: note.attendanceStatus,
        newAttendanceStatus: body.attendanceStatus ?? note.attendanceStatus,
        reason: body.reason.trim(),
        signature: signatureStored,
      },
    }),
    prisma.sessionNote.update({
      where: { id: note.id },
      data: {
        content: newContent,
        ...(body.attendanceStatus && { attendanceStatus: body.attendanceStatus }),
        ...(resignAndResetApproval && {
          status: 'CLINICIAN_SIGNED',
          clinicianSignedAt: new Date(),
          clinicianSignedById: user.id,
          clinicianSignatureData: signatureStored,
          signatureData: signatureStored, // legacy mirror
          adminSignedAt: null,
          adminSignedById: null,
          adminSignatureData: null,
          adminApprovalNote: null,
        }),
      },
    }),
  ])

  if (resignAndResetApproval) {
    await notifyAdmins({
      type: 'NOTE_READY_FOR_APPROVAL',
      title: 'Session note ready for approval',
      message: `${formatStoredUserNameForDisplay(note.client.user?.name ?? '') || 'A client'} · ${note.sessionName} (${note.kind === 'PSYCHOTHERAPY' ? 'Psychotherapy' : 'Progress'} note) has been edited and re-signed by the clinician and is awaiting your sign-off.`,
      sessionNoteId: note.id,
    })
  }

  return updated
})
