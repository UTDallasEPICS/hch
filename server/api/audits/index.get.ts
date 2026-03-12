import { createError, defineEventHandler, getHeaders, getQuery } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'

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
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const query = getQuery(event)
  const entityType = query.entityType as string | undefined
  const entityId = query.entityId as string | undefined

  const where: Record<string, unknown> = {}
  if (entityType) where.entityType = entityType
  if (entityId) where.entityId = entityId

  const audits = await prisma.changeAudit.findMany({
    where,
    orderBy: { signedAt: 'desc' },
    include: {
      signedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  return audits.map((audit) => ({
    id: audit.id,
    entityType: audit.entityType,
    entityId: audit.entityId,
    oldValue: audit.oldValue ? JSON.parse(audit.oldValue) : null,
    newValue: audit.newValue ? JSON.parse(audit.newValue) : null,
    reasoning: audit.reasoning,
    hasDocumentation: !!audit.documentationPath,
    documentationName: audit.documentationName,
    signedAt: audit.signedAt.toISOString(),
    signedBy: audit.signedBy,
  }))
})
