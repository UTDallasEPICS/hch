import { describe, expect, it } from 'vitest'
import { buildAvailabilitySlotCandidates, generateAvailabilitySlots } from './availability-slots'

describe('availability slot generation', () => {
  it('generates fixed-duration future slots for a one-off block within the horizon', () => {
    const slots = buildAvailabilitySlotCandidates({
      sourceType: 'ONE_OFF',
      clinicianUserId: 'clinician-1',
      createdByUserId: 'staff-1',
      location: 'Clinic',
      slotDurationMinutes: 60,
      bookingHorizonDays: 1,
      now: new Date('2026-01-05T15:00:00.000Z'),
      startTime: new Date('2026-01-05T14:00:00.000Z'),
      endTime: new Date('2026-01-07T00:00:00.000Z'),
    })

    expect(slots.length).toBe(23)
    expect(slots[0]?.startTime.toISOString()).toBe('2026-01-05T16:00:00.000Z')
    expect(slots.at(-1)?.startTime.toISOString()).toBe('2026-01-06T14:00:00.000Z')
    expect(slots.at(-1)?.endTime.toISOString()).toBe('2026-01-06T15:00:00.000Z')
  })

  it('rejects a one-off block whose end is not after its start', () => {
    expect(() =>
      buildAvailabilitySlotCandidates({
        sourceType: 'ONE_OFF',
        clinicianUserId: 'clinician-1',
        createdByUserId: 'staff-1',
        location: 'Clinic',
        slotDurationMinutes: 60,
        bookingHorizonDays: 1,
        now: new Date('2026-01-05T08:00:00.000Z'),
        startTime: new Date('2026-01-05T10:00:00.000Z'),
        endTime: new Date('2026-01-05T10:00:00.000Z'),
      })
    ).toThrow(/endTime must be after startTime/)
  })

  it('preserves clinician-local time across daylight-saving changes', () => {
    const slots = buildAvailabilitySlotCandidates({
      sourceType: 'RECURRING',
      clinicianUserId: 'clinician-1',
      createdByUserId: 'staff-1',
      location: 'Clinic',
      slotDurationMinutes: 60,
      bookingHorizonDays: 5,
      now: new Date('2026-03-07T18:00:00.000Z'),
      timeZone: 'America/Chicago',
      weeklyAvailability: [{ dayOfWeek: 2, startTime: '09:00', endTime: '11:00' }],
    })

    expect(slots.map((slot) => slot.startTime.toISOString())).toEqual([
      '2026-03-10T14:00:00.000Z',
      '2026-03-10T15:00:00.000Z',
    ])
  })

  it('fails clearly for local times skipped by a daylight-saving transition', () => {
    expect(() =>
      buildAvailabilitySlotCandidates({
        sourceType: 'RECURRING',
        clinicianUserId: 'clinician-1',
        createdByUserId: 'staff-1',
        location: 'Clinic',
        slotDurationMinutes: 30,
        bookingHorizonDays: 2,
        now: new Date('2026-03-08T06:00:00.000Z'),
        timeZone: 'America/Chicago',
        weeklyAvailability: [{ dayOfWeek: 0, startTime: '02:00', endTime: '03:00' }],
      })
    ).toThrow(/does not exist/)
  })

  it('omits slots overlapping appointments or existing availability when persisting', async () => {
    const created: Array<{ startTime: Date; endTime: Date }> = []
    const db = {
      appointment: {
        findMany: async () => [
          {
            startTime: new Date('2026-01-05T09:30:00.000Z'),
            endTime: new Date('2026-01-05T09:45:00.000Z'),
          },
        ],
      },
      availabilitySlot: {
        findMany: async () => [
          {
            startTime: new Date('2026-01-05T11:00:00.000Z'),
            endTime: new Date('2026-01-05T12:00:00.000Z'),
          },
        ],
        createMany: async ({ data }: { data: Array<{ startTime: Date; endTime: Date }> }) => {
          created.push(...data)
          return { count: data.length }
        },
      },
    }

    const result = await generateAvailabilitySlots(
      db as unknown as Parameters<typeof generateAvailabilitySlots>[0],
      {
        sourceType: 'ONE_OFF',
        clinicianUserId: 'clinician-1',
        createdByUserId: 'staff-1',
        location: 'Clinic',
        slotDurationMinutes: 60,
        bookingHorizonDays: 1,
        now: new Date('2026-01-05T08:00:00.000Z'),
        startTime: new Date('2026-01-05T09:00:00.000Z'),
        endTime: new Date('2026-01-05T12:00:00.000Z'),
      }
    )

    expect(result.createdCount).toBe(1)
    expect(created.map((slot) => [slot.startTime.toISOString(), slot.endTime.toISOString()])).toEqual([
      ['2026-01-05T10:00:00.000Z', '2026-01-05T11:00:00.000Z'],
    ])
  })
})
