import { prisma } from '../../utils/prisma'
import { readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const { clientId, adminId, title, description, date, startTime, endTime } = body

    if (!clientId || !adminId || !title || !date || !startTime || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields',
      })
    }

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

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
    console.error('Create appointment error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create appointment',
    })
  }
})
