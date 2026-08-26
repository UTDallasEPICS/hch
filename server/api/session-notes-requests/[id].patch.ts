import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { sendAppEmail } from '../../utils/mail'
import { formatStoredUserNameInitials } from '../../utils/name'
import { RECORDS_REQUEST_APPROVAL_WINDOW_DAYS } from '../../utils/declaration-templates'

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    rejectionReason: z.string().optional(),
    approvalReason: z.string().optional(),
    approvedSummaryText: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'reject') {
      const r = String(data.rejectionReason ?? '').trim()
      if (r.length < 3) {
        ctx.addIssue({
          code: 'custom',
          message: 'Rejection requires an explanation (at least a few characters)',
          path: ['rejectionReason'],
        })
      }
    }
    if (data.action === 'approve') {
      const r = String(data.approvalReason ?? '').trim()
      if (r.length < 3) {
        ctx.addIssue({
          code: 'custom',
          message: 'Approval requires a reason (at least a few characters)',
          path: ['approvalReason'],
        })
      }
    }
  })

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const req = await prisma.sessionNotesRequest.findUnique({
    where: { id },
    include: {
      client: { include: { user: { select: { email: true, name: true } } } },
    },
  })

  if (!req) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  }
  await assertStaffCanAccessClient(event, req.client.userId)
  if (req.status !== 'PENDING') {
    throw createError({ statusCode: 409, statusMessage: 'Request is no longer pending' })
  }

  const now = new Date()

  const clientInitials = formatStoredUserNameInitials(req.client.user.name)
  const greeting =
    clientInitials.length > 0 ? `<p>Hello ${escapeHtml(clientInitials)},</p>` : '<p>Hello,</p>'

  if (parsed.data.action === 'reject') {
    const reason = String(parsed.data.rejectionReason ?? '').trim()
    await prisma.sessionNotesRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedAt: now,
        decidedByUserId: user.id,
        rejectionReason: reason,
        approvalReason: null,
        approvedSummaryText: null,
      },
    })

    await sendAppEmail({
      to: req.client.user.email,
      subject: '[HCH] New records request update',
      html: `
        ${greeting}
        <p>Your records request was <strong>not approved</strong> at this time.</p>
        <p><strong>Reason:</strong></p>
        <p>${escapeHtml(reason).replace(/\n/g, '<br/>')}</p>
        <p>If you have questions, please contact the clinic.</p>
      `,
    })

    return { id, status: 'REJECTED' as const }
  }

  const approvalReason = String(parsed.data.approvalReason ?? '').trim()

  let summaryText: string | null = null
  if (req.requestKind === 'SUMMARY') {
    summaryText = String(parsed.data.approvedSummaryText ?? '').trim()
    if (summaryText.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Approving a summary request requires approved summary text',
      })
    }
    if (summaryText.length < 5) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Approved summary text must be at least 5 characters',
      })
    }
  }

  // Enforce the 14-day SLA: admins cannot approve a request that is already past its window.
  const windowMs = RECORDS_REQUEST_APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const expiresAt = new Date(req.createdAt.getTime() + windowMs)
  if (now > expiresAt) {
    throw createError({
      statusCode: 409,
      statusMessage: `This request has exceeded the ${RECORDS_REQUEST_APPROVAL_WINDOW_DAYS}-day approval window and must be rejected (or the client must submit a new request).`,
    })
  }

  await prisma.sessionNotesRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      decidedAt: now,
      decidedByUserId: user.id,
      rejectionReason: null,
      approvalReason,
      approvedSummaryText: req.requestKind === 'SUMMARY' ? summaryText : null,
    },
  })

  const accessDesc =
    req.requestKind === 'FULL'
      ? 'full session notes written by your clinician'
      : 'the approved summary of your session notes'

  await sendAppEmail({
    to: req.client.user.email,
    subject: '[HCH] New records request update',
    html: `
      ${greeting}
      <p>Your records request to view ${accessDesc} has been <strong>approved</strong>.</p>
      <p>Sign in to the client portal and use <strong>View session notes</strong> on your dashboard to read them.</p>
    `,
  })

  return { id, status: 'APPROVED' as const }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
