import { createError, type H3Event } from 'h3'
import { z } from 'zod'
import { prisma } from './prisma'
import type { AvailabilityGenerationInput } from './availability-slots'

const commonFields = {
  clinicianUserId: z.string().min(1),
  location: z.string().trim().min(1).max(200),
  videoUrl: z
    .union([z.string().trim().url(), z.literal('')])
    .optional()
    .refine(
      (value) => !value || ['http:', 'https:'].includes(new URL(value).protocol),
      'Video URL must use http or https'
    ),
  notes: z.string().trim().max(2000).optional(),
  slotDurationMinutes: z.number().int().min(15).max(240),
  bookingHorizonDays: z.number().int().min(1).max(180),
}

const weeklyRuleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
})

const generationRequestSchema = z.discriminatedUnion('sourceType', [
  z.object({
    ...commonFields,
    sourceType: z.literal('ONE_OFF'),
    startTime: z.string().datetime({ offset: true }),
    endTime: z.string().datetime({ offset: true }),
  }),
  z
    .object({
      ...commonFields,
      sourceType: z.literal('RECURRING'),
      timeZone: z
        .string()
        .min(1)
        .refine((timeZone) => {
          try {
            new Intl.DateTimeFormat('en-US', { timeZone })
            return true
          } catch {
            return false
          }
        }, 'Choose a valid IANA time zone'),
      weeklyAvailability: z.array(weeklyRuleSchema).min(1).max(7),
    })
    .superRefine((value, context) => {
      const days = value.weeklyAvailability.map((rule) => rule.dayOfWeek)
      if (new Set(days).size !== days.length) {
        context.addIssue({
          code: 'custom',
          message: 'Choose each weekday at most once',
          path: ['weeklyAvailability'],
        })
      }
    }),
])

export function parseAvailabilityGenerationRequest(
  body: unknown,
  createdByUserId: string
): AvailabilityGenerationInput {
  const parsed = generationRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message ?? 'Invalid availability details',
    })
  }

  const value = parsed.data
  const common = {
    ...value,
    createdByUserId,
    videoUrl: value.videoUrl?.trim() || null,
    notes: value.notes?.trim() || null,
    now: new Date(),
  }

  if (value.sourceType === 'ONE_OFF') {
    return {
      ...common,
      sourceType: value.sourceType,
      startTime: new Date(value.startTime),
      endTime: new Date(value.endTime),
    }
  }

  return {
    ...common,
    sourceType: value.sourceType,
  }
}

export async function assertAvailabilityClinicianAccess(event: H3Event, clinicianUserId: string) {
  const userId = event.context.user?.id
  if (!userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (event.context.isAdmin) {
    const clinician = await prisma.user.findUnique({
      where: { id: clinicianUserId },
      select: { role: true },
    })
    if (clinician?.role !== 'CLINICIAN') {
      throw createError({ statusCode: 400, statusMessage: 'Select a valid clinician' })
    }
    return
  }

  if (!event.context.isClinician || clinicianUserId !== userId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
}
