import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { readBody, createError, defineEventHandler } from 'h3'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import type { VideoConferenceProvider } from '../../../prisma/generated/enums'
import { randomUUID } from 'node:crypto'
import { MAX_RECURRING_OCCURRENCES } from '../../utils/appointment-constants'

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

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)

    const user = requireStaff(event)
    const adminId = user.id

    const { clientId, description, date, startTime, endTime, videoProvider, videoJoinUrl } = body

    const recurrenceInput = typeof body?.recurrence === 'string' ? body.recurrence.trim() : ''
    const recurrence = ['DAILY', 'WEEKLY', 'MONTHLY'].includes(recurrenceInput)
      ? recurrenceInput
      : 'NONE'
    const recurrenceEndDateInput =
      typeof body?.recurrenceEndDate === 'string' ? body.recurrenceEndDate.trim() : ''
    const seriesId = recurrence === 'NONE' ? null : randomUUID()

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

    let occurrences = 1
    if (recurrence !== 'NONE') {
      if (!recurrenceEndDateInput) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Recurrence end date is required for recurring sessions',
        })
      }
      const recurrenceEnd = new Date(`${recurrenceEndDateInput}T23:59:59.999`)
      if (Number.isNaN(recurrenceEnd.getTime())) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid recurrence end date',
        })
      }
      if (recurrenceEnd < start) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Recurrence end date must be on or after start date',
        })
      }
      let count = 0
      for (let i = 0; i < MAX_RECURRING_OCCURRENCES; i += 1) {
        const next = addRecurrenceStep(start, recurrence, i)
        if (next > recurrenceEnd) break
        count += 1
      }
      occurrences = count
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

    const [clientUser, existingAppointments] = await Promise.all([
      prisma.user.findUnique({
        where: { id: clientId },
        select: { name: true, role: true },
      }),
      prisma.appointment.findMany({
        where: { clientId },
        select: { sessionNumber: true, status: true },
      }),
    ])

    if (!clientUser || clientUser.role !== 'CLIENT') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid client ID',
      })
    }

    const activeSessionNumbers = existingAppointments
      .filter((a) => {
        const normalized = String(a.status ?? '').toUpperCase()
        return normalized !== 'CANCELED' && normalized !== 'CANCELLED'
      })
      .map((a) => a.sessionNumber)

    const usedSessionNumbers = [...activeSessionNumbers]
    const appointmentsToCreate: Array<{
      clientId: string
      adminId: string
      title: string
      sessionName: string
      sessionNumber: number
      description: string | null
      startTime: Date
      endTime: Date
      status: string
      seriesId: string | null
      recurrence: string
      videoProvider: VideoConferenceProvider | null
      videoJoinUrl: string | null
    }> = []

    for (let i = 0; i < occurrences; i += 1) {
      const nextSessionNumber = nextAvailableNumber(usedSessionNumbers)
      usedSessionNumbers.push(nextSessionNumber)
      const sessionName = deriveSessionName(clientUser.name, nextSessionNumber)
      appointmentsToCreate.push({
        clientId,
        adminId,
        title: sessionName,
        sessionName,
        sessionNumber: nextSessionNumber,
        description: description ?? null,
        startTime: addRecurrenceStep(start, recurrence, i),
        endTime: addRecurrenceStep(end, recurrence, i),
        status: 'SCHEDULED',
        seriesId,
        recurrence,
        videoProvider: parsedProvider ?? null,
        videoJoinUrl: normalizedJoin ?? null,
      })
    }

    const clientRow = await prisma.client.findUnique({
      where: { userId: clientId },
      select: { id: true },
    })

    const createdAppointments = await prisma.$transaction(async (tx) => {
      const created: Array<{ id: string; sessionName: string; sessionNumber: number }> = []
      for (const appointmentData of appointmentsToCreate) {
        const appointment = await tx.appointment.create({ data: appointmentData })
        created.push({
          id: appointment.id,
          sessionName: appointment.sessionName,
          sessionNumber: appointment.sessionNumber,
        })
      }

      if (clientRow) {
        for (const createdAppointment of created) {
          await tx.sessionNote.create({
            data: {
              clientId: clientRow.id,
              appointmentId: createdAppointment.id,
              sessionName: createdAppointment.sessionName,
              sessionNumber: createdAppointment.sessionNumber,
              content: '',
              attendanceStatus: 'show',
            },
          })
        }
      }

      return created
    })

    return {
      success: true,
      appointment: createdAppointments[0] ?? null,
      createdCount: createdAppointments.length,
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

    console.error('Error creating appointment:', error)

    throw createError({
      statusCode: 500,
      statusMessage: error?.message || JSON.stringify(error),
    })
  }
})
