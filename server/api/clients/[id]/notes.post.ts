import { requireAdmin } from '../../../utils/guard'
import { createError, defineEventHandler, getHeaders, getRouterParam, readBody } from 'h3'
import { prisma } from '../../../utils/prisma'
import { isAdmin } from '../../../utils/is-admin'

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event)

  const clientUserId = getRouterParam(event, 'id')
  if (!clientUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing client id' })
  }

  const body = await readBody<{ content: string; attended?: boolean; appointmentId?: string }>(event)
  if (!body?.content || typeof body.content !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }
  if (!body?.appointmentId || typeof body.appointmentId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'An appointment/session must be selected' })
  }
  const attended = body.attended !== false // default true

  const dbUser = await prisma.user.findFirst({
    where: { id: clientUserId, role: 'CLIENT' },
    include: { client: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 404, statusMessage: 'Client not found' })
  }

  let client = dbUser.client
  if (!client) {
    client = await prisma.client.create({
      data: { userId: clientUserId },
    })
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: body.appointmentId, clientId: clientUserId },
    select: { id: true, sessionName: true, sessionNumber: true },
  })
  if (!appointment) {
    throw createError({ statusCode: 400, statusMessage: 'Selected appointment not found for client' })
  }

  const note = await prisma.sessionNote.create({
    data: {
      clientId: client.id,
      content: body.content.trim(),
      attended,
      appointmentId: appointment.id,
      sessionName: appointment.sessionName,
      sessionNumber: appointment.sessionNumber,
    },
  })

  return note
})
