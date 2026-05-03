import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler } from 'h3'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import type { VideoConferenceProvider } from '../../../prisma/generated/enums'
import { createStaffAppointment } from '../../utils/create-staff-appointment'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const user = requireStaff(event)
    const adminId = user.id

    const { clientId, description, date, startTime, endTime, videoProvider, videoJoinUrl } = body

    if (!clientId || !date || !startTime || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields',
      })
    }

    await assertStaffCanAccessClient(event, clientId)

    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    const now = new Date()

    if (end <= start) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid time range',
      })
    }

    if (start < now) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Cannot create events in the past',
      })
    }

    const parsedProvider = parseVideoProviderInput(videoProvider) as VideoConferenceProvider | null

    const normalizedJoin = normalizeVideoJoinUrl(videoJoinUrl)
    const rawJoinInput = typeof videoJoinUrl === 'string' ? videoJoinUrl.trim() : ''

    if (rawJoinInput && !normalizedJoin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Enter a valid meeting link starting with http:// or https://',
      })
    }

    if (normalizedJoin && !parsedProvider) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Choose a video provider when adding a join link',
      })
    }

    let appointment
    try {
      appointment = await createStaffAppointment(prisma, {
        staffUserId: adminId,
        clientUserId: clientId,
        startTime: start,
        endTime: end,
        description,
        videoProvider: parsedProvider ?? null,
        videoJoinUrl: normalizedJoin ?? null,
      })
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'INVALID_CLIENT') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid client ID',
        })
      }
      throw e
    }

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

    console.error('🔥 BACKEND FULL ERROR:', error)
    console.error('🔥 BACKEND STACK:', error?.stack)

    throw createError({
      statusCode: 500,
      statusMessage: error?.message || JSON.stringify(error),
    })
  }
})
