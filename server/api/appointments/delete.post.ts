import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler, getHeaders } from 'h3'
import { auth } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const headers = new Headers()
    for (const [key, value] of Object.entries(getHeaders(event))) {
      if (value) headers.set(key, value)
    }

    const session = await auth.api.getSession({ headers })
    const adminId = session?.user?.id

    if (!adminId) {
      throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
    }

    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true },
    })

    if (!admin || admin.role !== 'ADMIN') {
      throw createError({ statusCode: 403, statusMessage: 'Only admins can delete sessions' })
    }

    const { id } = body

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing appointment ID',
      })
    }

    await prisma.appointment.delete({
      where: { id },
    })

    return {
      success: true,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Delete appointment error:', error)

    // Check if it's a Prisma error
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, any>
      console.error('Error details:', {
        message: errorObj.message,
        code: errorObj.code,
        meta: errorObj.meta,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete appointment',
    })
  }
})
