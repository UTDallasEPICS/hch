import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { auth } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (session.user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Admin only' })
  }

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const body = await readBody<{
    canViewScores?: boolean
    canViewNotes?: boolean
    canViewPlan?: boolean
  }>(event)

  const user = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: { include: { permissions: true } } },
  })

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = user.client
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
