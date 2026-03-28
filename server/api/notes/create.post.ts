import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers })
  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - please log in',
    })
  }

  const userId = session.user.id
  const body = await readBody<{ clientId: string; content: string }>(event)

  if (!body.clientId) {
    throw createError({ statusCode: 400, statusMessage: 'clientId is required' })
  }

  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Content is required' })
  }

  /** 
  let clientRow = await prisma.client.findFirst({
    where: { OR: [{ id: body.clientId }, { userId: body.clientId }] },
  })

  if (!clientRow) {
    const u = await prisma.user.findFirst({
      where: { id: body.clientId, role: 'CLIENT' },
      include: { client: true },
    })
    if (u?.client) clientRow = u.client
    else if (u) {
      clientRow = await prisma.client.create({ data: { userId: u.id } })
    }
  }

  if (!clientRow) {
    throw createError({ statusCode: 400, statusMessage: 'Client not found' })
  }

   */

  try {
    const note = await prisma.note.create({
      data: {
        userId,
        clientId: body.clientId,
        //clientRow.id,
        content: body.content.trim(),
      },
    })
    return { success: true, note }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save note in database',
    })
  }
})
