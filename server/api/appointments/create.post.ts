import { defineEventHandler, getHeaders, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const headers = new Headers()

  for (const [k, v] of Object.entries(getHeaders(event))) {
    if (v) headers.set(k, v)
  }

  const session = await auth.api.getSession({ headers })
  const user = session?.user

  if (!user || user.role !== 'ADMIN') {
    throw createError({ statusCode: 403 })
  }

  const body = await readBody(event)

  const appointment = await prisma.appointment.create({
    data: {
      title: body.title,
      description: body.description,
      clientId: body.clientId,
      adminId: user.id,
      startTime: new Date(body.start),
      endTime: new Date(body.end),
    },
  })

  return appointment
})
