import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireAdmin } from '../../../utils/guard'
import { prisma } from '../../../utils/prisma'
import { rankCliniciansForClient } from '../../../utils/clinician-match'

/**
 * Admin-only (REQ-F-05c): every clinician ranked against this client's tags,
 * excluding the current clinician. Route id is the client's USER id, like the
 * other /api/clients/[id] routes.
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const client = await prisma.client.findUnique({
    where: { userId: clientUserId },
    select: { id: true },
  })
  if (!client) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  return rankCliniciansForClient(client.id)
})
