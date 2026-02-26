import { defineEventHandler, getHeaders, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const headers = new Headers()

  for (const [k, v] of Object.entries(getHeaders(event))) {
    if (v) headers.set(k, v)
  }

  const session = await auth.api.getSession({ headers })
  const user = session?.user

  if (!user) {
    throw createError({ statusCode: 401 })
  }

  const where = user.role === 'CLIENT' ? { clientId: user.id } : {}

  const appointments = await prisma.appointment.findMany({
    where,
  })

  return appointments.map((a) => ({
    id: a.id,
    title: a.title,
    start: a.startTime,
    end: a.endTime,
  }))
})
