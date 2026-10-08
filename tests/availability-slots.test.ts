import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAvailabilitySlotCandidates,
  generateAvailabilitySlots,
} from '../server/utils/availability-slots'

test('one-off blocks generate fixed-duration future slots within the horizon', () => {
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

  assert.equal(slots.length, 23)
  assert.equal(slots[0].startTime.toISOString(), '2026-01-05T16:00:00.000Z')
  assert.equal(slots.at(-1)?.startTime.toISOString(), '2026-01-06T14:00:00.000Z')
  assert.equal(slots.at(-1)?.endTime.toISOString(), '2026-01-06T15:00:00.000Z')
})

test('weekly rules preserve clinician-local time across daylight-saving changes', () => {
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

  assert.deepEqual(
    slots.map((slot) => slot.startTime.toISOString()),
    ['2026-03-10T14:00:00.000Z', '2026-03-10T15:00:00.000Z']
  )
})

test('weekly rules fail clearly for local times skipped by a daylight-saving transition', () => {
  assert.throws(
    () =>
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
      }),
    /does not exist/
  )
})

test('persistence omits slots overlapping appointments or existing availability', async () => {
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

  const result = await generateAvailabilitySlots(db as unknown as Parameters<
    typeof generateAvailabilitySlots
  >[0], {
    sourceType: 'ONE_OFF',
    clinicianUserId: 'clinician-1',
    createdByUserId: 'staff-1',
    location: 'Clinic',
    slotDurationMinutes: 60,
    bookingHorizonDays: 1,
    now: new Date('2026-01-05T08:00:00.000Z'),
    startTime: new Date('2026-01-05T09:00:00.000Z'),
    endTime: new Date('2026-01-05T12:00:00.000Z'),
  })

  assert.equal(result.createdCount, 1)
  assert.deepEqual(
    created.map((slot) => [slot.startTime.toISOString(), slot.endTime.toISOString()]),
    [['2026-01-05T10:00:00.000Z', '2026-01-05T11:00:00.000Z']]
  )
})
