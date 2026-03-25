import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { sendAppEmail } from '../../utils/mail'
import { formatStoredUserNameForDisplay } from '../../utils/name'

const bodySchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    rejectionReason: z.string().optional(),
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
  })

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
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

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
  if (req.status !== 'PENDING') {
    throw createError({ statusCode: 409, statusMessage: 'Request is no longer pending' })
  }

  const now = new Date()

  const clientDisplayName = formatStoredUserNameForDisplay(req.client.user.name)

  if (parsed.data.action === 'reject') {
    const reason = String(parsed.data.rejectionReason ?? '').trim()
    await prisma.sessionNotesRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedAt: now,
        decidedByUserId: session.user.id,
        rejectionReason: reason,
        approvedSummaryText: null,
      },
    })

    await sendAppEmail({
      to: req.client.user.email,
      subject: '[HCH] Session notes request — decision',
      html: `
        <p>Hello ${escapeHtml(clientDisplayName)},</p>
        <p>Your request to access session notes was <strong>not approved</strong> at this time.</p>
        <p><strong>Reason:</strong></p>
        <p>${escapeHtml(reason).replace(/\n/g, '<br/>')}</p>
        <p>If you have questions, please contact the clinic.</p>
      `,
    })

    return { id, status: 'REJECTED' as const }
  }

  // approve
  let summaryText: string | null = null
  if (req.requestKind === 'SUMMARY') {
    summaryText = String(parsed.data.approvedSummaryText ?? '').trim()
    if (summaryText.length < 5) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Approving a summary request requires approved summary text',
      })
    }
  }

  await prisma.sessionNotesRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      decidedAt: now,
      decidedByUserId: session.user.id,
      rejectionReason: null,
      approvedSummaryText: req.requestKind === 'SUMMARY' ? summaryText : null,
    },
  })

  const accessDesc =
    req.requestKind === 'FULL'
      ? 'full session notes written by your clinician'
      : 'the approved summary of your session notes'

  await sendAppEmail({
    to: req.client.user.email,
    subject: '[HCH] Session notes request — approved',
    html: `
      <p>Hello ${escapeHtml(clientDisplayName)},</p>
      <p>Your request to view ${accessDesc} has been <strong>approved</strong>.</p>
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
