import { prisma } from '../../utils/prisma'
import { requireAdmin } from '../../utils/guard'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { type, startTime, seriesId, title, description, date, startTimeNew, endTimeNew } =
    await readBody(event)

  const newStart = new Date(`${date}T${startTimeNew}`)
  const newEnd = new Date(`${date}T${endTimeNew}`)

  // ONE
  if (type === 'ONE' || !seriesId) {
    await prisma.appointment.update({
      where: { id },
      data: { title, description, startTime: newStart, endTime: newEnd },
    })
  }

  // ALL
  else if (type === 'ALL') {
    await prisma.appointment.updateMany({
      where: { seriesId },
      data: { title, description },
    })
  }

  // FUTURE
  else if (type === 'FUTURE') {
    await prisma.appointment.updateMany({
      where: {
        seriesId,
        startTime: { gte: new Date(startTime) },
      },
      data: { title, description },
    })
  }

  return { success: true }
})
