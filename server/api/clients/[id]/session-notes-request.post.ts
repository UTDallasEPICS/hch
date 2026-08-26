import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { sendAppEmail, getAdminNotificationEmails } from '../../../utils/mail'
import { formatStoredUserNameInitials } from '../../../utils/name'
import { getLatestDeclarationTemplateId } from '../../../utils/declaration-templates'

/**
 * Optional YYYY-MM-DD string that coerces to a `Date` on the day boundary (UTC midnight).
 * Empty string or absent => null.
 */
const dateOnlySchema = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && v.length ? v : null))
  .refine((v) => v == null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Dates must be in YYYY-MM-DD format')
  .transform((v) => (v ? new Date(`${v}T00:00:00.000Z`) : null))

const bodySchema = z
  .object({
    requestKind: z.enum(['FULL', 'SUMMARY']),
    signatureData: z.string().min(20),
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'Start date must be on or before end date',
        path: ['endDate'],
      })
    }
  })

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId || clientUserId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = bodySchema.safeParse(await readBody(event))
  if (!body.success) {
    const msg = body.error.issues[0]?.message ?? 'Invalid request'
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  if (!body.data.signatureData.startsWith('data:image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature format' })
  }

  const client = await prisma.client.findUnique({
    where: { userId: clientUserId },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client record not found' })
  }

  const pending = await prisma.sessionNotesRequest.findFirst({
    where: { clientId: client.id, status: 'PENDING' },
  })
  if (pending) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already have a pending records request',
    })
  }

  const declarationTemplateId = await getLatestDeclarationTemplateId(prisma, body.data.requestKind)

  const created = await prisma.sessionNotesRequest.create({
    data: {
      clientId: client.id,
      requestKind: body.data.requestKind,
      signatureData: body.data.signatureData,
      declarationTemplateId,
      startDate: body.data.startDate,
      endDate: body.data.endDate,
    },
  })

  const admins = getAdminNotificationEmails()
  const clientInitials = formatStoredUserNameInitials(client.user.name)
  const kindLabel =
    body.data.requestKind === 'FULL' ? 'full session notes' : 'a summary of session notes'
  const initialsLine = clientInitials
    ? `<li><strong>Client initials:</strong> ${escapeHtml(clientInitials)}</li>`
    : ''
  const rangeLine = formatRangeLine(body.data.startDate, body.data.endDate)
  const html = `
    <p>A client submitted a records request for ${kindLabel}.</p>
    <ul>
      ${initialsLine}
      <li><strong>Request ID:</strong> ${escapeHtml(created.id)}</li>
      <li><strong>Submitted:</strong> ${created.createdAt.toISOString()}</li>
      ${rangeLine}
    </ul>
    <p>Sign in as an admin and open <strong>Clients &rarr; Records requests</strong> to approve or reject within 14 days.</p>
  `
  if (admins.length) {
    await sendAppEmail({
      to: admins,
      subject: '[HCH] New records request update',
      html,
    })
  }

  return { id: created.id, status: created.status }
})

function formatRangeLine(start: Date | null, end: Date | null): string {
  if (!start && !end) return '<li><strong>Range:</strong> All available records</li>'
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const s = start ? fmt(start) : '—'
  const e = end ? fmt(end) : '—'
  return `<li><strong>Range:</strong> ${escapeHtml(s)} to ${escapeHtml(e)}</li>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
