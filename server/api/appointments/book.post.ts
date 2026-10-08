import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { slotId, clientId } = body

    if (!slotId || !clientId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing slotId or clientId',
      })
    }

    const result = await prisma.$transaction(async (tx) => {
      const slot = await tx.availabilitySlot.findUnique({
        where: { id: slotId },
        include: { clinician: true },
      })

      if (!slot || slot.status !== 'OPEN') {
        throw createError({
          statusCode: 409,
          statusMessage: 'This slot is no longer available.',
        })
      }

      const client = await tx.client.findUnique({
        where: { userId: clientId },
        select: { id: true, userId: true, clinicianUserId: true, user: { select: { name: true } } },
      })

      if (!client) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Client not found.',
        })
      }

      if (client.clinicianUserId !== slot.clinicianUserId) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Client can only book slots with their assigned clinician.',
        })
      }

      await tx.availabilitySlot.update({
        where: { id: slotId },
        data: { status: 'BOOKED' },
      })

      const appointment = await tx.appointment.create({
        data: {
          clientId: client.userId,
          adminId: slot.clinicianUserId,
          title: `Drop-in Session - ${client.user.name}`,
          sessionName: `Drop_In_${client.user.name?.replace(/\s+/g, '_')}`,
          sessionNumber: 1,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: 'SCHEDULED',
          recurrence: 'NONE',
        },
      })

      return appointment
    })

    return {
      success: true,
      appointment: result,
    }
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error booking slot atomically:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error?.message || 'Internal server error during booking',
    })
  }
})