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
  const body = await readBody(event)

  if (!body.clientId) {
    throw createError({ statusCode: 400, statusMessage: 'clientId is required' })
  }

  const content = body.content?.trim() || ''
  const attended = body.attended ?? true
  const noShowReason = attended === false ? (body.noShowReason?.trim() || null) : null

  try {
    const note = await prisma.note.create({
      data: {
        userId,
        clientId: body.clientId,
        content: body.content?.trim() || '',
        attended: body.attended ?? true,
      }
    })
    return { success: true, note }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save note in database',
    })
  }
})
