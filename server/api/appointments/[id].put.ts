import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/guard'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  requireAdmin(event)

  try {
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
    const { title, description, date, startTime, endTime } = await readBody(event)

    const startTimeDate = new Date(`${date}T${startTime}`)
    const endTimeDate = new Date(`${date}T${endTime}`)

    await prisma.appointment.update({
      where: { id },
      data: {
        title,
        description,
        startTime: startTimeDate,
        endTime: endTimeDate,
      },
    })

    return { success: true }
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Appointment not found',
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error updating appointment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update appointment',
    })
  }
})
