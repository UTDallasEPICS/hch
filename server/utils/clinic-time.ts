/**
 * Clinic timezone helpers (#126).
 *
 * v1 rule: every appointment time is in ONE clinic timezone (America/Chicago
 * by default). There are no per-user timezones.
 *
 * Why this exists: the booking form sends a date and a time with no timezone
 * ("2026-10-20" + "14:00"). `new Date('2026-10-20T14:00')` reads that in the
 * SERVER's timezone, which is Chicago on our laptops but UTC on AWS. These
 * helpers always read and print times in the clinic timezone instead, so the
 * result is the same wherever the server runs.
 */

export const CLINIC_TIME_ZONE = process.env.CLINIC_TIME_ZONE || 'America/Chicago'

type WallTime = {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  ms: number
}

/** What the clock on the clinic wall says at this instant. */
function wallTimeOf(instant: Date, timeZone: string): WallTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    ms: instant.getUTCMilliseconds(),
  }
}

/** The instant when the clinic wall clock shows this time. */
function instantOfWallTime(w: WallTime, timeZone: string): Date {
  // Treat the wall time as if it were UTC, then shift by the zone's offset.
  // Done twice so it lands right on days when the offset changes (DST).
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second, w.ms)
  let guess = asUtc
  for (let i = 0; i < 2; i++) {
    const seen = wallTimeOf(new Date(guess), timeZone)
    const seenAsUtc = Date.UTC(
      seen.year,
      seen.month - 1,
      seen.day,
      seen.hour,
      seen.minute,
      seen.second,
      seen.ms
    )
    guess += asUtc - seenAsUtc
  }
  return new Date(guess)
}

/**
 * Turn a date ("2026-10-20") and time ("14:00" or "14:00:00.000") from a form
 * into the real instant, read in the clinic timezone.
 * Returns an Invalid Date if the input can't be parsed, same as `new Date()`.
 */
export function clinicDateTime(date: string, time: string, timeZone = CLINIC_TIME_ZONE): Date {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(time)
  if (!d || !t) return new Date(NaN)
  return instantOfWallTime(
    {
      year: Number(d[1]),
      month: Number(d[2]),
      day: Number(d[3]),
      hour: Number(t[1]),
      minute: Number(t[2]),
      second: Number(t[3] ?? 0),
      ms: Number((t[4] ?? '0').padEnd(3, '0')),
    },
    timeZone
  )
}

/**
 * Move an appointment by N days or N months, keeping the same clinic
 * wall-clock time. A weekly 2pm session stays at 2pm after the DST switch.
 */
export function addClinicTime(
  base: Date,
  amount: { days?: number; months?: number },
  timeZone = CLINIC_TIME_ZONE
): Date {
  const w = wallTimeOf(base, timeZone)
  // Date.UTC handles overflow (e.g. day 32 -> next month) for us.
  const shifted = new Date(
    Date.UTC(w.year, w.month - 1 + (amount.months ?? 0), w.day + (amount.days ?? 0))
  )
  return instantOfWallTime(
    {
      ...w,
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    },
    timeZone
  )
}

/** "Oct 20, 2026, 2:00 PM" in clinic time, for notification messages. */
export function formatClinicTime(d: Date, timeZone = CLINIC_TIME_ZONE): string {
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone })
}
