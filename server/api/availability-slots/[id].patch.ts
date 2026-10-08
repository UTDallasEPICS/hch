import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { requireStaff } from '../../utils/guard'
import { assertAvailabilityClinicianAccess } from '../../utils/availability-request'
import { prisma } from '../../utils/prisma'

const updateSchema = z.object({
  startTime: z.string().datetime({ offset: true }),
  endTime: z.string().datetime({ offset: true }),
  location: z.string().trim().min(1).max(200),
  videoUrl: z
    .union([z.string().trim().url(), z.literal('')])
    .nullable()
    .refine(
      (value) => !value || ['http:', 'https:'].includes(new URL(value).protocol),
      'Video URL must use http or https'
    ),
  notes: z.string().trim().max(2000).nullable(),
})

export default defineEventHandler(async (event) => {
  requireStaff(event)
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing slot id' })

  const parsed = updateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? 'Invalid slot details',
    })
  }

  const startTime = new Date(parsed.data.startTime)
  const endTime = new Date(parsed.data.endTime)
  const now = new Date()
  if (startTime <= now || endTime <= startTime) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slot must have a future start time and end after it',
    })
  }

  const existing = await prisma.availabilitySlot.findUnique({
    where: { id },
    select: { clinicianUserId: true, startTime: true, status: true },
  })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Availability slot not found' })
  await assertAvailabilityClinicianAccess(event, existing.clinicianUserId)
  if (existing.status !== 'OPEN' || existing.startTime <= now) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Only future open availability slots can be edited',
    })
  }

  const conflicts = await prisma.appointment.findMany({
    where: {
      startTime: { lt: endTime },
      endTime: { gt: startTime },
      OR: [
        { adminId: existing.clinicianUserId },
        { client: { client: { clinicianUserId: existing.clinicianUserId } } },
      ],
      NOT: [{ status: { in: ['CANCELLED', 'CANCELED'] } }],
    },
    select: { id: true },
    take: 1,
  })
  if (conflicts.length) {
    throw createError({ statusCode: 409, statusMessage: 'Slot overlaps an existing appointment' })
  }

  const otherSlots = await prisma.availabilitySlot.findMany({
    where: {
      id: { not: id },
      clinicianUserId: existing.clinicianUserId,
      status: { in: ['OPEN', 'BOOKED'] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
    select: { id: true },
    take: 1,
  })
  if (otherSlots.length) {
    throw createError({ statusCode: 409, statusMessage: 'Slot overlaps other published availability' })
  }

  const updated = await prisma.availabilitySlot.updateMany({
    where: { id, status: 'OPEN', startTime: { gt: now } },
    data: {
      startTime,
      endTime,
      location: parsed.data.location,
      videoUrl: parsed.data.videoUrl?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    },
  })
  if (updated.count !== 1) {
    throw createError({ statusCode: 409, statusMessage: 'Availability slot is no longer editable' })
  }

  return prisma.availabilitySlot.findUniqueOrThrow({ where: { id } })
})
