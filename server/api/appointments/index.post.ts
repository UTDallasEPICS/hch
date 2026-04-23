import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler } from 'h3'
import { v4 as uuidv4 } from 'uuid'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const user = requireAdmin(event)
    const adminId = user.id

    const { clientId, title, description, date, startTime, endTime, isRecurring, recurrence } = body

    if (!clientId || !title || !date || !startTime || !endTime) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required fields' })
    }

    const baseStart = new Date(`${date}T${startTime}`)
    const baseEnd = new Date(`${date}T${endTime}`)

    if (baseEnd <= baseStart) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid time range' })
    }

    const seriesId = isRecurring ? uuidv4() : null
    const count = isRecurring ? 20 : 1

    const appointmentsToCreate = []

    for (let i = 0; i < count; i++) {
      const newStart = new Date(baseStart)
      const newEnd = new Date(baseEnd)

      if (isRecurring) {
        if (recurrence === 'DAILY') {
          newStart.setDate(baseStart.getDate() + i)
          newEnd.setDate(baseEnd.getDate() + i)
        }

        if (recurrence === 'WEEKLY') {
          newStart.setDate(baseStart.getDate() + i * 7)
          newEnd.setDate(baseEnd.getDate() + i * 7)
        }

        if (recurrence === 'MONTHLY') {
          newStart.setMonth(baseStart.getMonth() + i)
          newEnd.setMonth(baseEnd.getMonth() + i)
        }
      }

      appointmentsToCreate.push({
        clientId,
        adminId,
        title,
        description,
        startTime: newStart,
        endTime: newEnd,
        status: 'SCHEDULED',
        seriesId,
        recurrence: isRecurring ? recurrence : null,
      })
    }

    await prisma.appointment.createMany({
      data: appointmentsToCreate,
    })

    return { success: true }
  } catch (error: any) {
    console.error('🔥 BACKEND FULL ERROR:', error)
    console.error('🔥 BACKEND STACK:', error?.stack)

    throw createError({
      statusCode: 500,
      statusMessage: error?.message || JSON.stringify(error),
    })
  }
})
