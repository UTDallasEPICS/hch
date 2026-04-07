import { requireUser } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../../utils/prisma'
import { sendAppEmail, getAdminNotificationEmails } from '../../../utils/mail'
import { formatStoredUserNameInitials } from '../../../utils/name'
import { getLatestDeclarationTemplateId } from '../../../utils/declaration-templates'

const bodySchema = z.object({
  requestKind: z.enum(['FULL', 'SUMMARY']),
  signatureData: z.string().min(20),
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
      statusMessage: 'You already have a pending session notes request',
    })
  }

  const declarationTemplateId = await getLatestDeclarationTemplateId(
    prisma,
    body.data.requestKind
  )

  const created = await prisma.sessionNotesRequest.create({
    data: {
      clientId: client.id,
      requestKind: body.data.requestKind,
      signatureData: body.data.signatureData,
      declarationTemplateId,
    },
  })

  const admins = getAdminNotificationEmails()
  const clientInitials = formatStoredUserNameInitials(client.user.name)
  const kindLabel = body.data.requestKind === 'FULL' ? 'full session notes' : 'a summary of session notes'
  const initialsLine = clientInitials
    ? `<li><strong>Client initials:</strong> ${escapeHtml(clientInitials)}</li>`
    : ''
  const html = `
    <p>A client submitted a request to view ${kindLabel}.</p>
    <ul>
      ${initialsLine}
      <li><strong>Request ID:</strong> ${escapeHtml(created.id)}</li>
      <li><strong>Submitted:</strong> ${created.createdAt.toISOString()}</li>
    </ul>
    <p>Sign in as an admin and open <strong>Clients → Session note requests</strong> to approve or reject.</p>
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
