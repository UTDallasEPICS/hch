import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const { id, title, description, date, startTime, endTime } = await readBody(event)

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
  } catch (error) {
    console.error('Error updating appointment:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update appointment',
    })
  }
})
