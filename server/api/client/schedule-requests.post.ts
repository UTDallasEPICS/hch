import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireClientUser } from '../../utils/guard'

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

  const clientRow = await prisma.client.findUnique({
    where: { userId: user.id },
    select: { id: true },
  })
  if (!clientRow) {
    throw createError({ statusCode: 403, statusMessage: 'Client profile not found' })
  }

  const body = await readBody(event)
  const { date, startTime, endTime, message } = body as {
    date?: string
    startTime?: string
    endTime?: string
    message?: string
  }

  if (!date || !startTime || !endTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing date, startTime, or endTime',
    })
  }

  const start = new Date(`${date}T${startTime}`)
  const end = new Date(`${date}T${endTime}`)
  const slotErr = validateSlot(start, end)
  if (slotErr) {
    throw createError({ statusCode: 400, statusMessage: slotErr })
  }

  const msg =
    typeof message === 'string' && message.trim().length > 0 ? message.trim().slice(0, 2000) : null

  const row = await prisma.appointmentScheduleRequest.create({
    data: {
      clientId: user.id,
      requestedStartTime: start,
      requestedEndTime: end,
      message: msg,
    },
    select: {
      id: true,
      requestedStartTime: true,
      requestedEndTime: true,
      message: true,
      status: true,
      createdAt: true,
    },
  })

  return {
    id: row.id,
    requestedStartTime: row.requestedStartTime.toISOString(),
    requestedEndTime: row.requestedEndTime.toISOString(),
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
})
