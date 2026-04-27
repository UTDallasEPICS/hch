import { requireStaff } from '../../utils/guard'
import { assertStaffCanAccessClient } from '../../utils/clinician-access'
import { prisma } from '../../utils/prisma'
import { normalizeVideoJoinUrl, parseVideoProviderInput } from '../../utils/video-conference'
import { readBody, createError, defineEventHandler } from 'h3'
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

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid date/time range',
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
    const sessionNumber = nextAvailableNumber(activeSessionNumbers)
    const sessionName = deriveSessionName(clientUser.name, sessionNumber)

    const appointment = await prisma.appointment.create({
      data: {
        clientId,
        adminId,
        title: sessionName,
        sessionName,
        sessionNumber,
        description,
        startTime: start,
        endTime: end,
        status: 'SCHEDULED',
        ...(parsedProvider != null && { videoProvider: parsedProvider }),
        ...(normalizedJoin != null && { videoJoinUrl: normalizedJoin }),
      },
    })

    const clientRow = await prisma.client.findUnique({
      where: { userId: clientId },
      select: { id: true },
    })
    if (clientRow) {
      await prisma.sessionNote.create({
        data: {
          clientId: clientRow.id,
          appointmentId: appointment.id,
          sessionName,
          sessionNumber,
          content: '',
          attended: true,
        },
      })
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

    console.error('Create appointment error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create appointment',
    })
  }
})
