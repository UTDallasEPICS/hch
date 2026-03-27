import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { auth } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { isAllFormsComplete } from '../../utils/client-forms'
import type { ClientStatus } from '../../../prisma/generated/client'
import { isClientStatusLabel, toDbClientStatus } from '../../utils/client-status'

const VALID_STATUSES = ['Prospective', 'Waitlist', 'Active', 'Archived'] as const
const MAX_THERAPY_WEEKS = 26

export default defineEventHandler(async (event) => {
  const requestHeaders = new Headers()
  for (const [key, value] of Object.entries(getHeaders(event))) {
    if (value !== undefined) requestHeaders.set(key, value)
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing client id',
    })
  }

  const body = await readBody<{
    status?: string
    therapyWeek?: number | null
    missedSessions?: number
  }>(event)

  if (!body?.status && body?.therapyWeek === undefined && body?.missedSessions === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one of status, therapyWeek, or missedSessions is required',
    })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Client not found',
    })
  }

  if (body.status !== undefined) {
    if (!isClientStatusLabel(body.status)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      })
    }

    const targetStatus = toDbClientStatus(body.status)

    if (targetStatus === 'WAITLIST') {
      const allFormsComplete = await isAllFormsComplete(prisma, userId)
      if (!allFormsComplete) {
        throw createError({
          statusCode: 400,
          statusMessage: 'To move to waitlist, need to complete all forms',
        })
      }
    }
    if (targetStatus === 'ACTIVE') {
      const currentStatus = user.client?.status ?? 'INCOMPLETE'
      if (currentStatus !== 'WAITLIST' && currentStatus !== 'ARCHIVED') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Client must be on waitlist before they can be marked active',
        })
      }
    }
    if (targetStatus === 'ARCHIVED') {
      const currentStatus = user.client?.status ?? 'INCOMPLETE'
      if (currentStatus !== 'ACTIVE') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Client must be active before they can be archived',
        })
      }
    }
  }

  let therapyWeek: number | null | undefined = body.therapyWeek
  if (therapyWeek !== undefined && therapyWeek !== null) {
    if (therapyWeek < 0 || therapyWeek > MAX_THERAPY_WEEKS) {
      throw createError({
        statusCode: 400,
        statusMessage: `therapyWeek must be between 0 and ${MAX_THERAPY_WEEKS}`,
      })
    }
  }

  const missedSessions = body.missedSessions
  if (missedSessions !== undefined && (missedSessions < 0 || !Number.isInteger(missedSessions))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'missedSessions must be a non-negative integer',
    })
  }

  let client = user.client
  if (!client) {
    client = await prisma.client.create({
      data: {
        userId,
        status: body.status ? toDbClientStatus(body.status) : 'INCOMPLETE',
        therapyWeek: therapyWeek ?? null,
        missedSessions: missedSessions ?? 0,
      },
    })
  }

  const updateData: {
    status?: ClientStatus
    therapyWeek?: number | null
    missedSessions?: number
  } = {}
  if (body.status !== undefined) updateData.status = toDbClientStatus(body.status)
  if (therapyWeek !== undefined) updateData.therapyWeek = therapyWeek
  if (missedSessions !== undefined) updateData.missedSessions = missedSessions

  const updated = await prisma.client.update({
    where: { id: client.id },
    data: updateData,
  })

  return updated
})
