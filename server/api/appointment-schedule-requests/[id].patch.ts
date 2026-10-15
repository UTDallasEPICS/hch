import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import {
  formatAppointmentTimeRange,
  sendAppEmail,
  sendAppointmentConfirmationEmail,
} from '../../utils/mail'
import { formatStoredUserNameInitials } from '../../utils/name'
import { createStaffAppointment } from '../../utils/create-staff-appointment'

const bodySchema = z
  .object({
    action: z.enum(['accept', 'deny']),
    staffResponseNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'deny') {
      const r = String(data.staffResponseNote ?? '').trim()
      if (r.length < 3) {
        ctx.addIssue({
          code: 'custom',
          message: 'Please explain why this request is denied (at least a few characters).',
          path: ['staffResponseNote'],
        })
      }
    }
  })

export default defineEventHandler(async (event) => {
  const user = requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing id' })
  }

  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Invalid request'
    throw createError({ statusCode: 400, statusMessage: msg })
  }

  const req = await prisma.appointmentScheduleRequest.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, email: true, name: true } },
    },
  })

  if (!req) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  }

  await assertStaffCanAccessClient(event, req.clientId)

  if (req.status !== 'PENDING') {
    throw createError({ statusCode: 409, statusMessage: 'Request is no longer pending' })
  }

  const now = new Date()
  const start = req.requestedStartTime
  const end = req.requestedEndTime

  if (parsed.data.action === 'accept' && start < now) {
    throw createError({
      statusCode: 400,
      statusMessage:
        'This requested start time is already in the past. Ask the client to update the request.',
    })
  }

  const clientInitials = formatStoredUserNameInitials(req.client.name)
  const greeting =
    clientInitials.length > 0 ? `<p>Hello ${escapeHtml(clientInitials)},</p>` : '<p>Hello,</p>'

  const rangeHtml = `<p><strong>Requested time:</strong> ${escapeHtml(formatAppointmentTimeRange(start, end))}</p>`

  if (parsed.data.action === 'deny') {
    const note = String(parsed.data.staffResponseNote ?? '').trim()
    await prisma.appointmentScheduleRequest.update({
      where: { id },
      data: {
        status: 'DENIED',
        decidedAt: now,
        decidedByUserId: user.id,
        staffResponseNote: note,
      },
    })

    await sendAppEmail({
      to: req.client.email,
      subject: '[HCH] Session time request update',
      html: `
        ${greeting}
        <p>Your requested session time could not be scheduled.</p>
        ${rangeHtml}
        <p><strong>Message from the clinic:</strong></p>
        <p>${escapeHtml(note).replace(/\n/g, '<br/>')}</p>
        <p>You can submit a new request from your dashboard if you need a different time.</p>
      `,
    })

    return { id, status: 'DENIED' as const }
  }

  const appointment = await prisma.$transaction(async (tx) => {
    const appt = await createStaffAppointment(tx, {
      staffUserId: user.id,
      clientUserId: req.clientId,
      startTime: start,
      endTime: end,
      description: req.message,
      videoProvider: null,
      videoJoinUrl: null,
    })

    await tx.appointmentScheduleRequest.update({
      where: { id },
      data: {
        status: 'ACCEPTED',
        decidedAt: now,
        decidedByUserId: user.id,
        staffResponseNote: null,
        createdAppointmentId: appt.id,
      },
    })

    return appt
  })

  await sendAppointmentConfirmationEmail({
    to: req.client.email,
    startTime: start,
    endTime: end,
    clientName: clientInitials,
  })

  return {
    id,
    status: 'ACCEPTED' as const,
    appointmentId: appointment.id,
  }
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
