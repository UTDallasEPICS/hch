import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireClientUser } from '../../../utils/guard'

function validateSlot(start: Date, end: Date) {
  const now = new Date()
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Invalid date or time.'
  }
  if (end <= start) {
    return 'End time must be after start time.'
  }
  if (start < now) {
    return 'Cannot request time slots in the past.'
  }
  return null
}

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const existing = await prisma.appointmentScheduleRequest.findFirst({
    where: { id, clientId: user.id },
  })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  }
  if (existing.status !== 'PENDING') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only pending requests can be edited',
    })
  }

  const body = await readBody(event)
  const { date, startTime, endTime, message } = body as {
    date?: string
    startTime?: string
    endTime?: string
    message?: string | null
  }

  const hasTimeFields = date !== undefined || startTime !== undefined || endTime !== undefined
  if (hasTimeFields) {
    if (!date || !startTime || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'To change the time, provide date, startTime, and endTime together',
      })
    }
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    const slotErr = validateSlot(start, end)
    if (slotErr) {
      throw createError({ statusCode: 400, statusMessage: slotErr })
    }

    const msgUpdate =
      message !== undefined
        ? typeof message === 'string' && message.trim().length > 0
          ? message.trim().slice(0, 2000)
          : null
        : undefined

    const updated = await prisma.appointmentScheduleRequest.update({
      where: { id },
      data: {
        requestedStartTime: start,
        requestedEndTime: end,
        ...(msgUpdate !== undefined ? { message: msgUpdate } : {}),
      },
      select: {
        id: true,
        requestedStartTime: true,
        requestedEndTime: true,
        message: true,
        status: true,
        updatedAt: true,
      },
    })

    return {
      id: updated.id,
      requestedStartTime: updated.requestedStartTime.toISOString(),
      requestedEndTime: updated.requestedEndTime.toISOString(),
      message: updated.message,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    }
  }

  if (message === undefined) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No changes provided',
    })
  }

  const msg =
    typeof message === 'string' && message.trim().length > 0 ? message.trim().slice(0, 2000) : null

  const updated = await prisma.appointmentScheduleRequest.update({
    where: { id },
    data: { message: msg },
    select: {
      id: true,
      requestedStartTime: true,
      requestedEndTime: true,
      message: true,
      status: true,
      updatedAt: true,
    },
  })

  return {
    id: updated.id,
    requestedStartTime: updated.requestedStartTime.toISOString(),
    requestedEndTime: updated.requestedEndTime.toISOString(),
    message: updated.message,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  }
})
