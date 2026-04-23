import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'

/**
 * Admin-only: assign (or unassign) a clinician to a given client.
 * Body: { clinicianUserId: string | null }
 */
export default defineEventHandler(async (event) => {
  requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const body = await readBody<{ clinicianUserId: string | null }>(event)
  const clinicianUserId = body?.clinicianUserId ?? null

  if (clinicianUserId !== null) {
    const clinician = await prisma.user.findUnique({
      where: { id: clinicianUserId },
      select: { role: true },
    })
    if (!clinician || clinician.role !== 'CLINICIAN') {
      throw createError({ statusCode: 400, statusMessage: 'Selected user is not a clinician' })
    }
  }

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })
  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId, clinicianUserId },
    })
  } else {
    client = await prisma.client.update({
      where: { id: client.id },
      data: { clinicianUserId },
    })
  }

  return { clinicianUserId: client.clinicianUserId }
})
