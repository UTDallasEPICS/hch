import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getRouterParam } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const auditId = getRouterParam(event, 'id')
  if (!auditId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing audit id' })
  }

  const audit = await prisma.changeAudit.findUnique({
    where: { id: auditId },
    select: { signatureData: true },
  })

  if (!audit) {
    throw createError({ statusCode: 404, statusMessage: 'Audit not found' })
  }

  return { signatureData: audit.signatureData }
})
