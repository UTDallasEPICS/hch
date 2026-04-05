import { requireAdmin } from '../../utils/guard'
import { createError, defineEventHandler, getHeaders } from 'h3'
import { prisma } from '../../utils/prisma'
import { isAdmin } from '../../utils/is-admin'
import { ensureDefaultDeclarationTemplates } from '../../utils/declaration-templates'

export default defineEventHandler(async (event) => {

  const user = requireAdmin(event)

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
