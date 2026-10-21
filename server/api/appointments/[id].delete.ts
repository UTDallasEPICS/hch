import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { emailUsers, notifyUser, resolveAppointmentRecipients } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const { type, startTime } = await readBody(event)

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing appointment id',
    })
  }

  // keep stage auth checks
  requireStaff(event)

  const existing = await prisma.appointment.findUnique({
    where: { id },
    select: {
      clientId: true,
      seriesId: true,
      startTime: true,
    },
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Appointment not found',
    })
  }

  await assertStaffCanAccessClient(event, existing.clientId)

  // Scope series deletes to the series of the appointment we just authorized.
  // Never trust a seriesId from the body: it could belong to another client.
  const seriesId = existing.seriesId

  let deletedCount = 0

  // ONE event only
  if (type === 'ONE' || !seriesId) {
    await prisma.appointment.delete({
      where: { id },
    })
    deletedCount = 1
  }

  // entire series
  else if (type === 'ALL') {
    const result = await prisma.appointment.deleteMany({
      where: {
        seriesId,
      },
    })
    deletedCount = result.count
  }

  // this and future
  else if (type === 'FUTURE') {
    const result = await prisma.appointment.deleteMany({
      where: {
        seriesId,
        startTime: {
          gte: new Date(startTime),
        },
      },
    })
    deletedCount = result.count
  }

  // Notify after the delete succeeds. No appointmentId: the row no longer exists.
  try {
    if (deletedCount > 0) {
      const when = existing.startTime.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Chicago',
      })
      const isSeries = deletedCount > 1

      const title = isSeries ? 'Recurring sessions cancelled' : 'Session cancelled'
      const message = isSeries
        ? `${deletedCount} sessions in a recurring series were cancelled.`
        : `The session on ${when} was cancelled.`

      const recipients = await resolveAppointmentRecipients(existing.clientId)
      for (const userId of recipients) {
        await notifyUser({
          userId,
          type: 'APPOINTMENT_CANCELLED',
          title,
          message,
        })
      }
      await emailUsers(recipients, {
        subject: title,
        intro: message,
        closing: 'Sign in to the portal and open Calendar for details.',
      })
    }
  } catch (err) {
    console.error('[appointments] cancel notification failed', err)
  }

  return { success: true }
})
