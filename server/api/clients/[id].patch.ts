import { requireUser } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { isAllFormsComplete } from '../../utils/client-forms'
import type { ClientStatus } from '../../../prisma/generated/client'
import { isClientStatusLabel, toDbClientStatus } from '../../utils/client-status'

const VALID_STATUSES = ['Prospective', 'Waitlist', 'Active', 'Archived'] as const
const MAX_THERAPY_WEEKS = 26

export default defineEventHandler(async (event) => {
  const user = requireUser(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing client id',
    })
  }

  if (user.id !== userId && !event.context.isStaff) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const body = await readBody<{
    status?: string
    therapyWeek?: number | null
    missedSessions?: number
  }>(event)

  if (
    !event.context.isStaff &&
    (body?.status !== undefined ||
      body?.therapyWeek !== undefined ||
      body?.missedSessions !== undefined)
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Only staff can modify status, therapyWeek, and missedSessions',
    })
  }

  if (event.context.isStaff && user.id !== userId) {
    await assertStaffCanAccessClient(event, userId)
  }

  if (!body?.status && body?.therapyWeek === undefined && body?.missedSessions === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one of status, therapyWeek, or missedSessions is required',
    })
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: userId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!dbUser) {
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
      const currentStatus = dbUser.client?.status ?? 'INCOMPLETE'
      if (currentStatus !== 'WAITLIST' && currentStatus !== 'ARCHIVED') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Client must be on waitlist before they can be marked active',
        })
      }
    }
    if (targetStatus === 'ARCHIVED') {
      const currentStatus = dbUser.client?.status ?? 'INCOMPLETE'
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

  let client = dbUser.client
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

  let waitlistedAt: Date | null | undefined
  let archivedAt: Date | null | undefined

  const updateData: {
    status?: ClientStatus
    therapyWeek?: number | null
    missedSessions?: number
  } = {}
  if (body.status !== undefined) {
    const nextStatus = toDbClientStatus(body.status)
    updateData.status = nextStatus
    if (nextStatus === 'WAITLIST') waitlistedAt = new Date()
    else if (dbUser.client?.status === 'WAITLIST') waitlistedAt = null
    if (nextStatus === 'ARCHIVED') archivedAt = new Date()
    else if (dbUser.client?.status === 'ARCHIVED') archivedAt = null
  }
  if (therapyWeek !== undefined) updateData.therapyWeek = therapyWeek
  if (missedSessions !== undefined) updateData.missedSessions = missedSessions

  const updated = await prisma.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: client.id },
      data: updateData,
    })

    if (waitlistedAt !== undefined || archivedAt !== undefined) {
      await tx.$executeRaw`
        UPDATE client
        SET waitlistedAt = COALESCE(${waitlistedAt}, waitlistedAt),
            archivedAt = COALESCE(${archivedAt}, archivedAt)
        WHERE id = ${client.id}
      `

      if (waitlistedAt === null) {
        await tx.$executeRaw`
          UPDATE client
          SET waitlistedAt = NULL
          WHERE id = ${client.id}
        `
      }

      if (archivedAt === null) {
        await tx.$executeRaw`
          UPDATE client
          SET archivedAt = NULL
          WHERE id = ${client.id}
        `
      }
    }

    return tx.client.findUniqueOrThrow({
      where: { id: client.id },
    })
  })

  return updated
})
