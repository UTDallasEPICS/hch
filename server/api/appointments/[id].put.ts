import { prisma } from '../../utils/prisma'
import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import type { VideoConferenceProvider } from '../../../prisma/generated/enums'
export default defineEventHandler(async (event) => {
  requireStaff(event)

  try {
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing ID',
      })
    }

    const body = await readBody(event)

    const { type, startTime, seriesId, description, date, endTime, videoProvider, videoJoinUrl } =
      body

    const startTimeDate = new Date(`${date}T${startTime}`)
    const endTimeDate = new Date(`${date}T${endTime}`)

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: {
        clientId: true,
        videoProvider: true,
        videoJoinUrl: true,
      },
    })

    if (!existing) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Appointment not found',
      })
    }

    await assertStaffCanAccessClient(event, existing.clientId)

    const parsedProvider =
      videoProvider !== undefined
        ? (parseVideoProviderInput(videoProvider) as VideoConferenceProvider | null)
        : undefined

    const parsedJoin = videoJoinUrl !== undefined ? normalizeVideoJoinUrl(videoJoinUrl) : undefined

    const rawJoinInput = typeof videoJoinUrl === 'string' ? videoJoinUrl.trim() : ''

    if (videoJoinUrl !== undefined && rawJoinInput && !parsedJoin) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Enter a valid meeting link starting with http:// or https://',
      })
    }

    const effectiveProvider = parsedProvider !== undefined ? parsedProvider : existing.videoProvider

    const effectiveJoin = parsedJoin !== undefined ? parsedJoin : existing.videoJoinUrl

    if (effectiveJoin && !effectiveProvider) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Choose a video provider when adding a join link',
      })
    }

    // Update only this event
    if (type === 'ONE' || !seriesId) {
      await prisma.appointment.update({
        where: { id },
        data: {
          description,
          startTime: startTimeDate,
          endTime: endTimeDate,
          ...(parsedProvider !== undefined && {
            videoProvider: parsedProvider,
          }),
          ...(parsedJoin !== undefined && {
            videoJoinUrl: parsedJoin,
          }),
        },
      })
    }

    // Update all events in series
    else if (type === 'ALL') {
      await prisma.appointment.updateMany({
        where: { seriesId },
        data: {
          description,
          ...(parsedProvider !== undefined && {
            videoProvider: parsedProvider,
          }),
          ...(parsedJoin !== undefined && {
            videoJoinUrl: parsedJoin,
          }),
        },
      })
    }

    // Update this and future events
    else if (type === 'FUTURE') {
      await prisma.appointment.updateMany({
        where: {
          seriesId,
          startTime: {
            gte: new Date(startTime),
          },
        },
        data: {
          description,
          ...(parsedProvider !== undefined && {
            videoProvider: parsedProvider,
          }),
          ...(parsedJoin !== undefined && {
            videoJoinUrl: parsedJoin,
          }),
        },
      })
    }

    return { success: true }
  } catch (error: unknown) {
    const err = error as { code?: string; statusCode?: number }

    if (err?.code === 'P2025') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Appointment not found',
      })
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error updating appointment:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update appointment',
    })
  }
})
