import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler, getHeaders } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const user = requireAdmin(event)
    const adminId = user.id

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
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    if (error?.code === 'P2003') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid client ID or Foreign Key constraint failed',
      })
    }

    console.error('Create appointment error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create appointment',
    })
  }
})
