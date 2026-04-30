import { prisma } from '../../utils/prisma'
import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import type { VideoConferenceProvider } from '../../../prisma/generated/enums'

function sanitizeNamePart(part: string | null | undefined) {
  const normalized = (part ?? '').trim().replace(/\s+/g, '_')
  return normalized.replace(/[^A-Za-z0-9_]/g, '')
}

function deriveSessionName(fullName: string | null | undefined, sessionNumber: number) {
  const raw = (fullName ?? '').trim()
  const pieces = raw.split(/\s+/).filter(Boolean)

  const first = sanitizeNamePart(pieces[0] ?? 'Client') || 'Client'
  const last = sanitizeNamePart(pieces.slice(1).join('_') || 'Unknown') || 'Unknown'

  return `${first}_${last}_${String(sessionNumber).padStart(2, '0')}`
}

function nextAvailableNumber(used: number[]) {
  const usedSet = new Set(used.filter((n) => Number.isInteger(n) && n > 0))
  let candidate = 1
  while (usedSet.has(candidate)) candidate += 1
  return candidate
}

function addRecurrenceStep(base: Date, recurrence: string, step: number) {
  const next = new Date(base)
  if (recurrence === 'DAILY') {
    next.setDate(next.getDate() + step)
    return next
  }
  if (recurrence === 'WEEKLY') {
    next.setDate(next.getDate() + step * 7)
    return next
  }
  if (recurrence === 'MONTHLY') {
    next.setMonth(next.getMonth() + step)
    return next
  }
  return next
}

function getOccurrencesUntilEndDate(start: Date, recurrence: string, recurrenceEndDate: string | null) {
  if (!recurrenceEndDate || recurrence === 'NONE') return null
  const endBoundary = new Date(`${recurrenceEndDate}T23:59:59.999`)
  if (Number.isNaN(endBoundary.getTime()) || endBoundary < start) return 0
  let count = 0
  for (let i = 0; i < 260; i += 1) {
    const nextStart = addRecurrenceStep(start, recurrence, i)
    if (nextStart > endBoundary) break
    count += 1
  }
  return count
}
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

    const {
      type,
      startTime,
      startTimeOfDay,
      seriesId,
      description,
      date,
      endTime,
      recurrence,
      recurrenceEndDate,
      videoProvider,
      videoJoinUrl,
    } = body

    const normalizedStartTimeOfDay =
      typeof startTimeOfDay === 'string'
        ? startTimeOfDay
        : typeof startTime === 'string' && /^\d{2}:\d{2}/.test(startTime)
          ? startTime
          : ''

    if (!date || !normalizedStartTimeOfDay || !endTime) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required date/time fields',
      })
    }

    const recurrenceInput = typeof recurrence === 'string' ? recurrence.trim() : ''
    const normalizedRecurrence = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(recurrenceInput)
      ? recurrenceInput
      : 'NONE'

    const startTimeDate = new Date(`${date}T${normalizedStartTimeOfDay}`)
    const endTimeDate = new Date(`${date}T${endTime}`)
    if (Number.isNaN(startTimeDate.getTime()) || Number.isNaN(endTimeDate.getTime()) || endTimeDate <= startTimeDate) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid time range',
      })
    }

    const existing = await prisma.appointment.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        adminId: true,
        status: true,
        title: true,
        sessionName: true,
        sessionNumber: true,
        videoProvider: true,
        videoJoinUrl: true,
        startTime: true,
        endTime: true,
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

    const updateDataBase = {
      description,
      recurrence: normalizedRecurrence,
      ...(parsedProvider !== undefined && {
        videoProvider: parsedProvider,
      }),
      ...(parsedJoin !== undefined && {
        videoJoinUrl: parsedJoin,
      }),
    }

    // Update only this event
    if (type === 'ONE' || !seriesId) {
      await prisma.appointment.update({
        where: { id },
        data: {
          ...updateDataBase,
          startTime: startTimeDate,
          endTime: endTimeDate,
          ...(normalizedRecurrence === 'NONE' && {
            seriesId: null,
          }),
        },
      })
    }

    // Update all events in series
    else if (type === 'ALL') {
      const seriesAppointments = await prisma.appointment.findMany({
        where: { seriesId },
        orderBy: { startTime: 'asc' },
        select: { id: true, startTime: true, sessionNumber: true },
      })
      const selectedIndex = seriesAppointments.findIndex((a) => a.id === id)
      const indexOffset = selectedIndex >= 0 ? selectedIndex : 0
      const anchorStart = addRecurrenceStep(startTimeDate, normalizedRecurrence, -indexOffset)
      const durationMs = endTimeDate.getTime() - startTimeDate.getTime()
      const desiredOccurrences =
        getOccurrencesUntilEndDate(anchorStart, normalizedRecurrence, recurrenceEndDate ?? null) ??
        seriesAppointments.length
      const targetCount = Math.max(desiredOccurrences, normalizedRecurrence === 'NONE' ? 1 : 0)
      const toUpdate = seriesAppointments.slice(0, targetCount)
      const toDelete = seriesAppointments.slice(targetCount)

      await prisma.$transaction(
        toUpdate.map((appointment, index) => {
          const nextStart = addRecurrenceStep(anchorStart, normalizedRecurrence, index)
          return prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              ...updateDataBase,
              startTime: nextStart,
              endTime: new Date(nextStart.getTime() + durationMs),
              ...(normalizedRecurrence === 'NONE' && { seriesId: null }),
            },
          })
        })
      )

      if (toDelete.length > 0) {
        await prisma.appointment.deleteMany({
          where: {
            id: {
              in: toDelete.map((appointment) => appointment.id),
            },
          },
        })
      }

      if (targetCount > toUpdate.length && normalizedRecurrence !== 'NONE' && seriesId) {
        const additionalCount = targetCount - toUpdate.length
        const [clientUser, existingNumbers] = await Promise.all([
          prisma.user.findUnique({
            where: { id: existing.clientId },
            select: { name: true },
          }),
          prisma.appointment.findMany({
            where: { clientId: existing.clientId },
            select: { sessionNumber: true },
          }),
        ])
        const usedNumbers = existingNumbers.map((a) => a.sessionNumber)
        const baseIndex = toUpdate.length
        const createData = Array.from({ length: additionalCount }, (_, idx) => {
          const nextStart = addRecurrenceStep(anchorStart, normalizedRecurrence, baseIndex + idx)
          const sessionNumber = nextAvailableNumber(usedNumbers)
          usedNumbers.push(sessionNumber)
          const sessionName = deriveSessionName(clientUser?.name, sessionNumber)
          return {
            clientId: existing.clientId,
            adminId: existing.adminId,
            title: sessionName,
            sessionName,
            sessionNumber,
            description: description ?? null,
            startTime: nextStart,
            endTime: new Date(nextStart.getTime() + durationMs),
            status: existing.status,
            seriesId,
            recurrence: normalizedRecurrence,
            videoProvider: parsedProvider !== undefined ? parsedProvider : existing.videoProvider,
            videoJoinUrl: parsedJoin !== undefined ? parsedJoin : existing.videoJoinUrl,
          }
        })
        if (createData.length > 0) {
          await prisma.appointment.createMany({ data: createData })
        }
      }
    }

    // Update this and future events
    else if (type === 'FUTURE') {
      const seriesAppointments = await prisma.appointment.findMany({
        where: {
          seriesId,
          startTime: {
            gte: new Date(startTime),
          },
        },
        orderBy: { startTime: 'asc' },
        select: { id: true },
      })
      const durationMs = endTimeDate.getTime() - startTimeDate.getTime()
      const desiredOccurrences =
        getOccurrencesUntilEndDate(startTimeDate, normalizedRecurrence, recurrenceEndDate ?? null) ??
        seriesAppointments.length
      const targetCount = Math.max(desiredOccurrences, normalizedRecurrence === 'NONE' ? 1 : 0)
      const toUpdate = seriesAppointments.slice(0, targetCount)
      const toDelete = seriesAppointments.slice(targetCount)
      await prisma.$transaction(
        toUpdate.map((appointment, index) => {
          const nextStart = addRecurrenceStep(startTimeDate, normalizedRecurrence, index)
          return prisma.appointment.update({
            where: { id: appointment.id },
            data: {
              ...updateDataBase,
              startTime: nextStart,
              endTime: new Date(nextStart.getTime() + durationMs),
              ...(normalizedRecurrence === 'NONE' && { seriesId: null }),
            },
          })
        })
      )

      if (toDelete.length > 0) {
        await prisma.appointment.deleteMany({
          where: {
            id: {
              in: toDelete.map((appointment) => appointment.id),
            },
          },
        })
      }

      if (targetCount > toUpdate.length && normalizedRecurrence !== 'NONE' && seriesId) {
        const additionalCount = targetCount - toUpdate.length
        const [clientUser, existingNumbers] = await Promise.all([
          prisma.user.findUnique({
            where: { id: existing.clientId },
            select: { name: true },
          }),
          prisma.appointment.findMany({
            where: { clientId: existing.clientId },
            select: { sessionNumber: true },
          }),
        ])
        const usedNumbers = existingNumbers.map((a) => a.sessionNumber)
        const baseIndex = toUpdate.length
        const createData = Array.from({ length: additionalCount }, (_, idx) => {
          const nextStart = addRecurrenceStep(startTimeDate, normalizedRecurrence, baseIndex + idx)
          const sessionNumber = nextAvailableNumber(usedNumbers)
          usedNumbers.push(sessionNumber)
          const sessionName = deriveSessionName(clientUser?.name, sessionNumber)
          return {
            clientId: existing.clientId,
            adminId: existing.adminId,
            title: sessionName,
            sessionName,
            sessionNumber,
            description: description ?? null,
            startTime: nextStart,
            endTime: new Date(nextStart.getTime() + durationMs),
            status: existing.status,
            seriesId,
            recurrence: normalizedRecurrence,
            videoProvider: parsedProvider !== undefined ? parsedProvider : existing.videoProvider,
            videoJoinUrl: parsedJoin !== undefined ? parsedJoin : existing.videoJoinUrl,
          }
        })
        if (createData.length > 0) {
          await prisma.appointment.createMany({ data: createData })
        }
      }
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
