import { prisma } from './prisma'
import { formatStoredUserNameForDisplay, formatStoredUserNameInitials } from './name'
import { getAssignedClinicianUserId } from './clinician-access'
import { emailUsers, type EmailMessage, type EmailRecipient } from './notifications'

export type AppointmentEmailKind = 'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'REMINDER'

export type AppointmentEmailInfo = {
  kind: AppointmentEmailKind
  clientUserId: string // the client's USER id
  clientInitials: string // e.g. "S.R."; staff emails never show the client's full name
  clinicianName: string // assigned clinician's name, or '' if none assigned
  when: string // session time, already formatted in clinic time
  previousWhen?: string // RESCHEDULED only: the old time
  count?: number // how many sessions (for "4 sessions booked")
  series?: boolean // true = about a whole recurring series (defaults to count > 1)
}

const CALENDAR_BUTTON = { label: 'Open Calendar', path: '/calendar' }

/** First name for the greeting, e.g. "sam||rivera" → "Sam". Empty if no name saved. */
function firstName(stored: string): string {
  return formatStoredUserNameForDisplay(stored).split(' ')[0] ?? ''
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** What each kind of change is called, for one session vs. a whole series. */
const WORDS: Record<AppointmentEmailKind, { one: string; many: string; verb: string }> = {
  BOOKED: { one: 'Session booked', many: 'Recurring sessions booked', verb: 'booked' },
  RESCHEDULED: { one: 'Session rescheduled', many: 'Recurring sessions rescheduled', verb: 'rescheduled' },
  CANCELLED: { one: 'Session cancelled', many: 'Recurring sessions cancelled', verb: 'cancelled' },
  REMINDER: { one: 'Session reminder', many: 'Session reminder', verb: 'coming up' },
}

/**
 * Build one person's appointment email. Three audiences:
 * - the client:      "You have a session booked with Dana Lee."
 * - their clinician: "You have a session booked with S.R."  (initials only, for privacy)
 * - admins (only when no clinician is assigned):
 *                    "A session with S.R. has been booked. No clinician is assigned to this client yet."
 */
export function buildAppointmentEmail(
  recipient: EmailRecipient,
  info: AppointmentEmailInfo
): EmailMessage {
  const isClient = recipient.id === info.clientUserId
  const hasClinician = Boolean(info.clinicianName)
  const count = info.count ?? 1
  const series = info.series ?? count > 1
  const client = info.clientInitials || 'a client'
  const w = WORDS[info.kind]

  // Who the session is with, from this reader's point of view
  const withWhom = isClient ? (hasClinician ? ` with ${info.clinicianName}` : '') : ` with ${client}`
  // Admins aren't in the session, so they read "A session", everyone else "Your session"
  const yourOrA = isClient || hasClinician ? 'Your' : 'A'

  let intro: string
  if (info.kind === 'REMINDER') {
    intro = `Reminder: ${yourOrA.toLowerCase()} session${withWhom} is coming up.`
  } else if (series) {
    const n = info.kind === 'RESCHEDULED' ? '' : `${count} `
    const start = yourOrA === 'Your' ? `Your ${n}` : n
    intro = capitalize(`${start}recurring sessions${withWhom} have been ${w.verb}.`)
  } else if (info.kind === 'BOOKED' && yourOrA === 'Your') {
    // Initials already end in "." so don't add a second one ("with P.S." not "with P.S..")
    intro = `You have a session booked${withWhom}`
    if (!intro.endsWith('.')) intro += '.'
  } else {
    intro = `${yourOrA} session${withWhom} has been ${w.verb}.`
  }
  if (!isClient && !hasClinician) intro += ' No clinician is assigned to this client yet.'

  const details: { label: string; value: string }[] = []
  if (info.kind === 'RESCHEDULED') {
    details.push({ label: 'New time', value: info.when })
    if (info.previousWhen) details.push({ label: 'Previous time', value: info.previousWhen })
  } else if (info.kind === 'CANCELLED') {
    details.push({ label: series ? 'Starting from' : 'Was scheduled for', value: info.when })
  } else {
    details.push({ label: series ? 'First session' : 'When', value: info.when })
  }

  return {
    subject: series ? w.many : w.one,
    greetingName: firstName(recipient.name),
    intro,
    details,
    button: CALENDAR_BUTTON,
    closing: isClient ? 'If you need to make a change, please contact the clinic.' : undefined,
  }
}

/**
 * Email everyone about an appointment, each with their own version.
 * Looks up the client's initials and their clinician's name so callers don't have to.
 */
export async function sendAppointmentEmails(
  recipientIds: string[],
  info: Omit<AppointmentEmailInfo, 'clientInitials' | 'clinicianName'>
): Promise<void> {
  const clinicianId = await getAssignedClinicianUserId(info.clientUserId)
  const [clientUser, clinician] = await Promise.all([
    prisma.user.findUnique({ where: { id: info.clientUserId }, select: { name: true } }),
    clinicianId
      ? prisma.user.findUnique({ where: { id: clinicianId }, select: { name: true } })
      : null,
  ])
  const clientInitials = formatStoredUserNameInitials(clientUser?.name ?? '')
  const clinicianName = clinician ? formatStoredUserNameForDisplay(clinician.name) : ''
  await emailUsers(recipientIds, (r) =>
    buildAppointmentEmail(r, { ...info, clientInitials, clinicianName })
  )
}