import { createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { ensureDefaultDeclarationTemplates } from '../../utils/declaration-templates'

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

  await ensureDefaultDeclarationTemplates(prisma)

  const pending = await prisma.sessionNotesRequest.findMany({
    where: { status: 'PENDING' },
    include: {
      declarationTemplate: true,
      client: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return pending.map((r) => ({
    id: r.id,
    requestKind: r.requestKind,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    declarationText: r.declarationTemplate.content,
    declarationTemplateId: r.declarationTemplateId,
    declarationVersion: r.declarationTemplate.version,
    signatureData: r.signatureData,
    clientUserId: r.client.userId,
    clientName: r.client.user.name,
    clientEmail: r.client.user.email,
  }))
})
