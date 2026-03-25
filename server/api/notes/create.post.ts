import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  console.log('API /notes/create called')

  let session
  try {
    session = await auth.api.getSession({ headers: event.headers })
    console.log('Session:', session ? 'exists' : 'missing')
  } catch (err) {
    console.error('Session fetch error:', err)
  }

  if (!session?.user?.id) {
    console.error('Unauthorized - no user ID in session')
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - please log in',
    })
  }

  const userId = session.user.id
  console.log('User ID:', userId)

  const body = await readBody(event)
  console.log('Request body:', body)

  if (!body.clientId) {
    console.error('Missing clientId')
    throw createError({ statusCode: 400, message: 'clientId is required' })
  }

  if (!body.content?.trim()) {
    console.error('Missing or empty content')
    throw createError({ statusCode: 400, message: 'Content is required' })
  }

  try {
    console.log('Attempting Prisma create...')
    const note = await prisma.note.create({
      data: {
        userId,
        clientId: body.clientId,
        content: body.content,
      },
    })
    console.log('Note created successfully:', note.id)
    return { success: true, note }
  } catch (err) {
    console.error('Prisma create failed:', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to save note in database',
    })
  }
})