import { requireAdmin } from '../../utils/guard'
import { createError, defineEventHandler, getHeaders, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'

export default defineEventHandler(async (event) => {

  const user = requireAdmin(event)

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
    documentationPath: audit.documentationPath,
    signedAt: audit.signedAt.toISOString(),
    signedBy: audit.signedBy,
  }))
})
