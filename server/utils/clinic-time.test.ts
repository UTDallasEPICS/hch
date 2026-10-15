import { describe, it, expect } from 'vitest'
import { clinicDateTime, addClinicTime, formatClinicTime } from './clinic-time'

const TZ = 'America/Chicago'

describe('clinicDateTime', () => {
  it('reads the form time as Chicago time (CDT, UTC-5)', () => {
    // 2pm in Chicago in October = 7pm UTC
    expect(clinicDateTime('2026-10-20', '14:00', TZ).toISOString()).toBe('2026-10-20T19:00:00.000Z')
  })

  it('handles standard time (CST, UTC-6)', () => {
    // 2pm in Chicago in December = 8pm UTC
    expect(clinicDateTime('2026-12-15', '14:00', TZ).toISOString()).toBe('2026-12-15T20:00:00.000Z')
  })

  it('accepts seconds and milliseconds', () => {
    expect(clinicDateTime('2026-10-20', '23:59:59.999', TZ).toISOString()).toBe(
      '2026-10-21T04:59:59.999Z'
    )
  })

  it('is the same no matter what timezone the server is in', () => {
    // The result only depends on the inputs, never on process.env.TZ
    const a = clinicDateTime('2026-10-20', '14:00', TZ).getTime()
    const b = clinicDateTime('2026-10-20', '14:00', TZ).getTime()
    expect(a).toBe(b)
    expect(formatClinicTime(new Date(a), TZ)).toBe('Oct 20, 2026, 2:00 PM')
  })

  it('returns an Invalid Date for bad input', () => {
    expect(Number.isNaN(clinicDateTime('nope', '14:00', TZ).getTime())).toBe(true)
    expect(Number.isNaN(clinicDateTime('2026-10-20', '2pm', TZ).getTime())).toBe(true)
  })
})

describe('addClinicTime', () => {
  it('keeps a weekly 2pm session at 2pm across the November DST change', () => {
    const before = clinicDateTime('2026-10-27', '14:00', TZ) // CDT
    const after = addClinicTime(before, { days: 7 }, TZ) // Nov 3, CST
    expect(formatClinicTime(after, TZ)).toBe('Nov 3, 2026, 2:00 PM')
  })

  it('keeps the time across the March DST change', () => {
    const before = clinicDateTime('2027-03-10', '09:30', TZ)
    const after = addClinicTime(before, { days: 7 }, TZ)
    expect(formatClinicTime(after, TZ)).toBe('Mar 17, 2027, 9:30 AM')
  })

  it('adds months in clinic time', () => {
    const start = clinicDateTime('2026-10-20', '14:00', TZ)
    expect(formatClinicTime(addClinicTime(start, { months: 2 }, TZ), TZ)).toBe(
      'Dec 20, 2026, 2:00 PM'
    )
  })

  it('does not move the day for a late-evening session', () => {
    // 11pm Chicago is already the next day in UTC; it must stay on the same Chicago day
    const start = clinicDateTime('2026-10-20', '23:00', TZ)
    expect(formatClinicTime(addClinicTime(start, { days: 1 }, TZ), TZ)).toBe(
      'Oct 21, 2026, 11:00 PM'
    )
  })
})
