import { requireAdmin } from '../../utils/guard'
import { prisma } from '../../utils/prisma'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import { readBody, createError, defineEventHandler } from 'h3'
import type { VideoConferenceProvider } from '../../../prisma/generated/enums'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const user = requireAdmin(event)
    const adminId = user.id

    const { clientId, title, description, date, startTime, endTime, videoProvider, videoJoinUrl } = body

    if (!clientId || !title || !date || !startTime || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields',
      })
    }

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date/time range',
      })
    }

    const parsedProvider = parseVideoProviderInput(videoProvider) as VideoConferenceProvider | null
    const normalizedJoin = normalizeVideoJoinUrl(videoJoinUrl)
    if (normalizedJoin && !parsedProvider) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Choose a video provider when adding a join link',
      })
    }

    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        title,
        description,
        startTime: start,
        endTime: end,
        status: 'SCHEDULED',
        ...(parsedProvider != null && { videoProvider: parsedProvider }),
        ...(normalizedJoin != null && { videoJoinUrl: normalizedJoin }),
      },
    })

    return {
      success: true,
      appointment,
    }
  } catch (error: any) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    if (error?.code === 'P2003') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid client ID or Foreign Key constraint failed',
      })
    }

    console.error('Create appointment error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create appointment',
    })
  }
})
