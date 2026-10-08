import type { PrismaClient } from '../../prisma/generated/client'

type AvailabilitySlotDb = Pick<PrismaClient, 'appointment' | 'availabilitySlot'>

type WeeklyAvailabilityRule = {
  dayOfWeek: number
  startTime: string
  endTime: string
}

type AvailabilityGenerationOptions = {
  clinicianUserId: string
  createdByUserId: string
  location: string
  videoUrl?: string | null
  notes?: string | null
  slotDurationMinutes: number
  bookingHorizonDays: number
  now?: Date
}

export type OneOffAvailabilityInput = AvailabilityGenerationOptions & {
  sourceType: 'ONE_OFF'
  startTime: Date
  endTime: Date
}

export type RecurringAvailabilityInput = AvailabilityGenerationOptions & {
  sourceType: 'RECURRING'
  timeZone: string
  weeklyAvailability: WeeklyAvailabilityRule[]
}

export type AvailabilityGenerationInput =
  | OneOffAvailabilityInput
  | RecurringAvailabilityInput

type SlotData = {
  clinicianUserId: string
  startTime: Date
  endTime: Date
  location: string
  videoUrl: string | null
  notes: string | null
  createdByUserId: string
  sourceType: 'ONE_OFF' | 'RECURRING'
}

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const MINUTES_PER_DAY = 24 * 60

function assertValidDate(date: Date, name: string) {
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${name} must be a valid date`)
  }
}

function assertOptions(input: AvailabilityGenerationInput, now: Date) {
  assertValidDate(now, 'now')

  if (!Number.isInteger(input.slotDurationMinutes) || input.slotDurationMinutes <= 0) {
    throw new Error('slotDurationMinutes must be a positive integer')
  }

  if (!Number.isInteger(input.bookingHorizonDays) || input.bookingHorizonDays <= 0) {
    throw new Error('bookingHorizonDays must be a positive integer')
  }

  if (!input.clinicianUserId.trim() || !input.createdByUserId.trim()) {
    throw new Error('clinicianUserId and createdByUserId are required')
  }

  if (!input.location.trim()) {
    throw new Error('location is required')
  }
}

function parseLocalTime(value: string, name: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
  if (!match) {
    throw new Error(`${name} must use 24-hour HH:mm format`)
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function datePartsAt(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  }
}

function dateKey(parts: Pick<DateParts, 'year' | 'month' | 'day'>) {
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function addCalendarDays(value: string, days: number) {
  const { year, month, day } = parseDateKey(value)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return dateKey({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
}

function localDateTimeToUtc(
  date: Pick<DateParts, 'year' | 'month' | 'day'>,
  minutes: number,
  timeZone: string
) {
  const target = {
    ...date,
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    second: 0,
  }
  const targetEpoch = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute
  )
  const candidates = new Set<number>()

  for (let offsetMinutes = -14 * 60; offsetMinutes <= 14 * 60; offsetMinutes += 15) {
    const candidate = new Date(targetEpoch + offsetMinutes * 60_000)
    const parts = datePartsAt(candidate, timeZone)
    if (
      parts.year === target.year &&
      parts.month === target.month &&
      parts.day === target.day &&
      parts.hour === target.hour &&
      parts.minute === target.minute
    ) {
      candidates.add(candidate.getTime())
    }
  }

  if (candidates.size === 0) {
    throw new Error(
      `Weekly availability contains a local time that does not exist in ${timeZone} because of a daylight-saving transition`
    )
  }

  // During the fall-back transition, use the first occurrence of an ambiguous local time.
  return new Date(Math.min(...candidates))
}

function makeSlotData(
  input: AvailabilityGenerationInput,
  startTime: Date,
  endTime: Date
): SlotData {
  return {
    clinicianUserId: input.clinicianUserId,
    startTime,
    endTime,
    location: input.location,
    videoUrl: input.videoUrl?.trim() || null,
    notes: input.notes?.trim() || null,
    createdByUserId: input.createdByUserId,
    sourceType: input.sourceType,
  }
}

function generateOneOffSlots(
  input: OneOffAvailabilityInput,
  now: Date,
  horizonEnd: Date
) {
  assertValidDate(input.startTime, 'startTime')
  assertValidDate(input.endTime, 'endTime')
  if (input.endTime <= input.startTime) {
    throw new Error('endTime must be after startTime')
  }

  const durationMs = input.slotDurationMinutes * 60_000
  const slots: SlotData[] = []

  for (
    let start = input.startTime.getTime();
    start + durationMs <= input.endTime.getTime();
    start += durationMs
  ) {
    const end = start + durationMs
    if (start > now.getTime() && end <= horizonEnd.getTime()) {
      slots.push(makeSlotData(input, new Date(start), new Date(end)))
    }
  }

  return slots
}

function generateRecurringSlots(
  input: RecurringAvailabilityInput,
  now: Date,
  horizonEnd: Date
) {
  if (!input.weeklyAvailability.length) {
    throw new Error('weeklyAvailability must contain at least one rule')
  }

  // Validate the zone before generating any rows so invalid input fails explicitly.
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: input.timeZone })
  formatter.format(now)

  const durationMs = input.slotDurationMinutes * 60_000
  const firstDate = dateKey(datePartsAt(now, input.timeZone))
  const lastDate = dateKey(datePartsAt(horizonEnd, input.timeZone))
  const slots: SlotData[] = []

  for (const rule of input.weeklyAvailability) {
    if (!Number.isInteger(rule.dayOfWeek) || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
      throw new Error('dayOfWeek must be an integer from 0 (Sunday) to 6 (Saturday)')
    }

    const startMinutes = parseLocalTime(rule.startTime, 'startTime')
    const endMinutes = parseLocalTime(rule.endTime, 'endTime')
    if (endMinutes <= startMinutes) {
      throw new Error('Weekly availability endTime must be after startTime on the same day')
    }
  }

  for (let date = firstDate; date <= lastDate; date = addCalendarDays(date, 1)) {
    const { year, month, day } = parseDateKey(date)
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()

    for (const rule of input.weeklyAvailability) {
      if (rule.dayOfWeek !== weekday) continue

      const startMinutes = parseLocalTime(rule.startTime, 'startTime')
      const endMinutes = parseLocalTime(rule.endTime, 'endTime')
      const blockStart = localDateTimeToUtc({ year, month, day }, startMinutes, input.timeZone)
      const blockEnd = localDateTimeToUtc({ year, month, day }, endMinutes, input.timeZone)

      for (
        let start = blockStart.getTime();
        start + durationMs <= blockEnd.getTime();
        start += durationMs
      ) {
        const end = start + durationMs
        if (start > now.getTime() && end <= horizonEnd.getTime()) {
          slots.push(makeSlotData(input, new Date(start), new Date(end)))
        }
      }
    }
  }

  return slots
}

export function buildAvailabilitySlotCandidates(input: AvailabilityGenerationInput) {
  const now = input.now ?? new Date()
  assertOptions(input, now)
  const horizonEnd = new Date(
    now.getTime() + input.bookingHorizonDays * MINUTES_PER_DAY * 60_000
  )

  return input.sourceType === 'ONE_OFF'
    ? generateOneOffSlots(input, now, horizonEnd)
    : generateRecurringSlots(input, now, horizonEnd)
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

export async function getAvailableAvailabilitySlotCandidates(
  db: AvailabilitySlotDb,
  input: AvailabilityGenerationInput
) {
  const candidates = buildAvailabilitySlotCandidates(input)
  if (candidates.length === 0) return []

  const earliestStart = candidates.reduce(
    (earliest, slot) => (slot.startTime < earliest ? slot.startTime : earliest),
    candidates[0].startTime
  )
  const latestEnd = candidates.reduce(
    (latest, slot) => (slot.endTime > latest ? slot.endTime : latest),
    candidates[0].endTime
  )
  const [appointments, existingSlots] = await Promise.all([
    db.appointment.findMany({
      where: {
        startTime: { lt: latestEnd },
        endTime: { gt: earliestStart },
        OR: [
          { adminId: input.clinicianUserId },
          { client: { client: { clinicianUserId: input.clinicianUserId } } },
        ],
        NOT: [{ status: { in: ['CANCELLED', 'CANCELED'] } }],
      },
      select: { startTime: true, endTime: true },
    }),
    db.availabilitySlot.findMany({
      where: {
        clinicianUserId: input.clinicianUserId,
        status: { in: ['OPEN', 'BOOKED'] },
        startTime: { lt: latestEnd },
        endTime: { gt: earliestStart },
      },
      select: { startTime: true, endTime: true },
    }),
  ])

  const availableSlots = candidates.filter(
    (slot) =>
      !appointments.some((appointment) =>
        overlaps(slot.startTime, slot.endTime, appointment.startTime, appointment.endTime)
      ) &&
      !existingSlots.some((existing) =>
        overlaps(slot.startTime, slot.endTime, existing.startTime, existing.endTime)
      )
  )

  return availableSlots
}

export async function generateAvailabilitySlots(
  db: AvailabilitySlotDb,
  input: AvailabilityGenerationInput
) {
  const availableSlots = await getAvailableAvailabilitySlotCandidates(db, input)
  if (availableSlots.length === 0) return { createdCount: 0 }

  const result = await db.availabilitySlot.createMany({ data: availableSlots })
  return { createdCount: result.count }
}
