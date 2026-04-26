import { requireAdmin } from '../../../../../utils/guard'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { notifyUser } from '../../../../../utils/notifications'

/**
 * Admin-only final sign-off on a clinician-signed session note.
 * Requires an admin signature (PNG data URL). Optional `approvalNote`.
 * On success: status -> FULLY_APPROVED, admin signature fields populated,
 * and the clinician who signed the note (if any) is notified.
 */
export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  const noteId = getRouterParam(event, 'noteId')
  if (!clientUserId || !noteId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client or note id' })
  }

  const body = await readBody<{
    adminSignatureData?: string
    approvalNote?: string
  }>(event)

  const sig = body?.adminSignatureData ?? ''
  if (!sig.startsWith('data:image/png;base64,') || sig.length < 100) {
    throw createError({ statusCode: 400, statusMessage: 'A valid admin signature is required' })
  }

  const note = await prisma.sessionNote.findFirst({
    where: { id: noteId, client: { userId: clientUserId } },
    select: {
      id: true,
      status: true,
      kind: true,
      sessionName: true,
      clinicianSignedById: true,
      client: { select: { user: { select: { name: true } } } },
    },
  })
  if (!note) {
    throw createError({ statusCode: 404, statusMessage: 'Session note not found' })
  }
  if (note.status !== 'CLINICIAN_SIGNED') {
    throw createError({
      statusCode: 409,
      statusMessage:
        note.status === 'DRAFT'
          ? 'This note is still a draft — the clinician must sign it first.'
          : 'This note has already been fully approved.',
    })
  }

  const updated = await prisma.sessionNote.update({
    where: { id: note.id },
    data: {
      status: 'FULLY_APPROVED',
      adminSignedAt: new Date(),
      adminSignedById: user.id,
      adminSignatureData: sig,
      adminApprovalNote: body?.approvalNote?.trim() || null,
    },
  })

  if (note.clinicianSignedById) {
    const clientName = note.client?.user?.name ?? 'the client'
    await notifyUser({
      userId: note.clinicianSignedById,
      type: 'NOTE_FULLY_APPROVED',
      title: 'Session note approved',
      message: `Your ${note.kind === 'PSYCHOTHERAPY' ? 'psychotherapy' : 'progress'} note for ${clientName} · ${note.sessionName} has been fully approved.`,
      sessionNoteId: note.id,
    })
  }

  return updated
})
