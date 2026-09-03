import { requireStaff } from '../../../utils/guard'
import { assertStaffCanAccessClient } from '../../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { formatStoredUserNameForDisplay } from '../../../utils/name'
import { notifyAdmins } from '../../../utils/notifications'
import type { SessionNoteKind, SessionNoteStatus } from '../../../../prisma/generated/enums'

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

const VALID_KINDS: SessionNoteKind[] = ['PROGRESS', 'PSYCHOTHERAPY']
const VALID_ACTIONS = ['save-draft', 'clinician-sign'] as const
type SaveAction = (typeof VALID_ACTIONS)[number]

/**
 * Create or update a session note. Supports the two-tier approval flow:
 *   - action="save-draft"       -> no signature required, status=DRAFT
 *   - action="clinician-sign"   -> requires clinicianSignatureData, status=CLINICIAN_SIGNED,
 *                                 notifies every admin that a note is ready for approval.
 *
 * Admin counter-sign happens on a separate endpoint:
 *   POST /api/clients/[id]/session-notes/[noteId]/approve
 */
export default defineEventHandler(async (event) => {
  const user = requireStaff(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }
  await assertStaffCanAccessClient(event, clientUserId)

  const body = await readBody<{
    content?: string
    attendanceStatus?: string
    appointmentId?: string
    kind?: SessionNoteKind
    action?: SaveAction
    /**
     * Accepted for back-compat. When `action` is omitted, a note submitted with
     * `signatureData` behaves like a clinician-sign (legacy behaviour).
     */
    signatureData?: string
    /** Signature captured specifically for the clinician-sign tier. */
    clinicianSignatureData?: string
    /** Required when updating an existing note (audit trail). */
    reason?: string
  }>(event)

  if (!body?.content || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body?.appointmentId || typeof body.appointmentId !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'An appointment/session must be selected',
    })
  }

  const kind: SessionNoteKind =
    body?.kind && VALID_KINDS.includes(body.kind) ? body.kind : 'PROGRESS'

  // Action inference: explicit action wins; otherwise fall back to the legacy
  // behaviour where any saved note required a signature (=> clinician-sign).
  const action: SaveAction =
    body?.action && VALID_ACTIONS.includes(body.action) ? body.action : 'clinician-sign'

  const clinicianSignature = body?.clinicianSignatureData ?? body?.signatureData ?? null

  if (action === 'clinician-sign') {
    if (!clinicianSignature || typeof clinicianSignature !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Clinician signature is required to sign a note',
      })
    }
    const isBase64Png =
      clinicianSignature.startsWith('data:image/png;base64,') && clinicianSignature.length >= 100
    const isFontSignature =
      clinicianSignature.startsWith('{') && clinicianSignature.includes('"type":"font-signature"')

    if (!isBase64Png && !isFontSignature) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid signature data format' })
    }
  }

  const attendanceStatus = body.attendanceStatus ?? ''
  const hasAttendance = attendanceStatus.length > 0

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })
  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({ data: { userId: clientUserId } })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: body.appointmentId, clientId: clientUserId },
    select: { id: true, sessionName: true, sessionNumber: true, startTime: true },
  })
  if (!appointment) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Selected appointment not found for client',
    })
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
  if (action === 'clinician-sign' && !hasAttendance) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Attendance status is required when signing a session note.',
    })
  }

  const existingNote = await prisma.sessionNote.findFirst({
    where: { appointmentId: appointment.id, clientId: client.id },
    select: { id: true, content: true, status: true, kind: true },
  })

  // Editing an already-approved note is not allowed from this endpoint; use the
  // PATCH route which requires a justification + re-signing cycle.
  if (existingNote && existingNote.status === 'FULLY_APPROVED') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This note is fully approved. Use the edit flow to revise an approved note.',
    })
  }

  const nextStatus: SessionNoteStatus = action === 'clinician-sign' ? 'CLINICIAN_SIGNED' : 'DRAFT'

  const clinicianFields =
    action === 'clinician-sign'
      ? {
          clinicianSignedAt: new Date(),
          clinicianSignedById: user.id,
          clinicianSignatureData: clinicianSignature,
          signatureData: clinicianSignature, // legacy mirror
        }
      : {}

  if (existingNote) {
    // Editing an existing row (draft -> draft, draft -> signed, or signed re-sign).
    if (existingNote.status === 'CLINICIAN_SIGNED' && !body.reason?.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage:
          'A reason is required when updating a note that has already been clinician-signed.',
      })
    }

    const [, updated] = await prisma.$transaction([
      prisma.sessionNoteEdit.create({
        data: {
          sessionNoteId: existingNote.id,
          originalContent: existingNote.content,
          reason: body.reason?.trim() || (action === 'save-draft' ? 'Draft save' : 'Re-signed'),
          signature: clinicianSignature ?? null,
        },
      }),
      prisma.sessionNote.update({
        where: { id: existingNote.id },
        data: {
          content,
          attendanceStatus,
          kind,
          status: nextStatus,
          ...clinicianFields,
          // Reset admin approval fields when content changes after an approval.
          adminSignedAt: null,
          adminSignedById: null,
          adminSignatureData: null,
          adminApprovalNote: null,
        },
      }),
    ])

    if (action === 'clinician-sign') {
      await notifyAdmins({
        type: 'NOTE_READY_FOR_APPROVAL',
        title: 'Session note ready for approval',
        message: `${formatStoredUserNameForDisplay(dbUser.name ?? '') || 'A client'} · ${appointment.sessionName} (${kind === 'PSYCHOTHERAPY' ? 'Psychotherapy' : 'Progress'} note) has been signed by the clinician and is awaiting your sign-off.`,
        sessionNoteId: existingNote.id,
      })
    }

    return updated
  }

  const created = await prisma.sessionNote.create({
    data: {
      clientId: client.id,
      content,
      attendanceStatus,
      kind,
      status: nextStatus,
      appointmentId: appointment.id,
      sessionName: appointment.sessionName,
      sessionNumber: appointment.sessionNumber,
      ...clinicianFields,
    },
  })

  if (action === 'clinician-sign') {
    await notifyAdmins({
      type: 'NOTE_READY_FOR_APPROVAL',
      title: 'Session note ready for approval',
      message: `${formatStoredUserNameForDisplay(dbUser.name ?? '') || 'A client'} · ${appointment.sessionName} (${kind === 'PSYCHOTHERAPY' ? 'Psychotherapy' : 'Progress'} note) has been signed by the clinician and is awaiting your sign-off.`,
      sessionNoteId: created.id,
    })
  }

  return created
})
