import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { type, startTime, seriesId } = await readBody(event)

  if (!id) throw createError({ statusCode: 400 })

  // ONE
  if (type === 'ONE' || !seriesId) {
    await prisma.appointment.delete({ where: { id } })
  }

  // ALL
  else if (type === 'ALL') {
    await prisma.appointment.deleteMany({
      where: { seriesId },
    })
  }

  // FUTURE
  else if (type === 'FUTURE') {
    await prisma.appointment.deleteMany({
      where: {
        seriesId,
        startTime: {
          gte: new Date(startTime),
        },
      },
    })
  }

  return { success: true }
})
