import { createError, defineEventHandler, getRouterParam } from 'h3'
import { requireClientUser } from '../../../utils/guard'
import { createStaffAppointment } from '../../../utils/create-staff-appointment'
import { isEmailConfigured, sendAppointmentConfirmationEmail } from '../../../utils/mail'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireClientUser(event)
  const slotId = getRouterParam(event, 'id')
  if (!slotId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing availability slot id' })
  }

  const booking = await prisma.$transaction(async (tx) => {
    const now = new Date()
    const client = await tx.client.findUnique({
      where: { userId: user.id },
      select: { clinicianUserId: true },
    })
    if (!client?.clinicianUserId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'You need an assigned clinician before booking a session',
      })
    }

    const slot = await tx.availabilitySlot.findUnique({
      where: { id: slotId },
    })
    if (!slot || slot.clinicianUserId !== client.clinicianUserId) {
      throw createError({ statusCode: 404, statusMessage: 'Availability slot not found' })
    }
    if (slot.status !== 'OPEN' || slot.startTime <= now) {
      throw createError({ statusCode: 409, statusMessage: 'This availability slot is no longer open' })
    }

    const appointmentConflict = await tx.appointment.findFirst({
      where: {
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
        OR: [{ adminId: slot.clinicianUserId }, { clientId: user.id }],
        NOT: [{ status: { in: ['CANCELLED', 'CANCELED'] } }],
      },
      select: { id: true },
    })
    if (appointmentConflict) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This time conflicts with an existing appointment',
      })
    }

    const claimedSlot = await tx.availabilitySlot.updateMany({
      where: {
        id: slot.id,
        clinicianUserId: client.clinicianUserId,
        status: 'OPEN',
        startTime: { gt: now },
      },
      data: { status: 'BOOKED' },
    })
    if (claimedSlot.count !== 1) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This availability slot has already been booked',
      })
    }

    const appointment = await createStaffAppointment(tx, {
      staffUserId: slot.clinicianUserId,
      clientUserId: user.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      description: slot.notes,
      videoProvider: null,
      videoJoinUrl: null,
    })

    await tx.availabilitySlot.update({
      where: { id: slot.id },
      data: { appointmentId: appointment.id },
    })

    return { appointment, slot }
  })

  let confirmationEmailSent = isEmailConfigured()
  try {
    await sendAppointmentConfirmationEmail({
      to: user.email,
      startTime: booking.appointment.startTime,
      endTime: booking.appointment.endTime,
      location: booking.slot.location,
      clientName: user.name,
    })
  } catch (error: unknown) {
    confirmationEmailSent = false
    console.error('[availability-booking] Confirmation email failed after appointment was booked', error)
  }

  return {
    appointmentId: booking.appointment.id,
    startTime: booking.appointment.startTime,
    endTime: booking.appointment.endTime,
    confirmationEmailSent,
  }
})
