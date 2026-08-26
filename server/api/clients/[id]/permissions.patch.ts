import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const body = await readBody<{
    canViewScores?: boolean
    canViewNotes?: boolean
    canViewPlan?: boolean
  }>(event)

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: { include: { permissions: true } } },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId },
      include: { permissions: true },
    })
  }

  const perms = await prisma.clientPermission.upsert({
    where: { clientId: client.id },
    create: {
      clientId: client.id,
      canViewScores: body?.canViewScores ?? false,
      canViewNotes: body?.canViewNotes ?? false,
      canViewPlan: body?.canViewPlan ?? false,
    },
    update: {
      ...(body?.canViewScores !== undefined && { canViewScores: body.canViewScores }),
      ...(body?.canViewNotes !== undefined && { canViewNotes: body.canViewNotes }),
      ...(body?.canViewPlan !== undefined && { canViewPlan: body.canViewPlan }),
    },
  })

  return perms
})
