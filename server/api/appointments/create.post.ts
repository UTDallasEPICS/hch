import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const headers = new Headers()
    for (const [key, value] of Object.entries(getHeaders(event))) {
      if (value) headers.set(key, value)
    }

    const session = await auth.api.getSession({ headers })
    const adminId = session?.user?.id

    if (!adminId) {
      throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    })

    if (!admin || admin.role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Only admins can create sessions' })
    }

    const { clientId, title, description, date, startTime, endTime } = body

    if (!clientId || !title || !date || !startTime || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields',
      })
    }

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date/time range',
      })
    }

    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        title,
        description,
        startTime: start,
        endTime: end,
        status: 'SCHEDULED',
      },
    })

    return {
      success: true,
      appointment,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Create appointment error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create appointment',
    })
  }
})
