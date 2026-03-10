import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.headers,
  })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - please log in',
    })
  }

  const userId = session.user.id
  const body = await readBody(event)

  // Basic validation
  if (!body.content?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Content is required and cannot be empty',
    })
  }

  if (!body.clientId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'clientId is required',
    })
  }

  try {
    const note = await prisma.note.create({
      data: {
        userId,                 // secure: from session
        clientId: body.clientId,
        content: body.content,
      },
    })

    return {
      success: true,
      message: 'Note created successfully',
      note,
    }
  } catch (err) {
    console.error('Prisma create note error:', err)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save note in database',
    })
  }
})