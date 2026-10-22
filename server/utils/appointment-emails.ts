import { prisma } from './prisma'
import { formatStoredUserNameForDisplay, formatStoredUserNameInitials } from './name'
import { emailUsers, type EmailMessage, type EmailRecipient } from './notifications'

export type AppointmentEmailKind = 'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'REMINDER'

export type AppointmentEmailInfo = {
  kind: AppointmentEmailKind
  clientUserId: string // the client's USER id
  clientInitials: string // e.g. "S.R."; staff emails never show the full name
  when: string // session time, already formatted in clinic time
  previousWhen?: string // RESCHEDULED only: the old time
  count?: number // more than 1 = a whole recurring series
}

const CALENDAR_BUTTON = { label: 'Open Calendar', path: '/calendar' }

/** First name for the greeting, e.g. "sam||rivera" → "Sam". Empty if no name saved. */
function firstName(stored: string): string {
  return formatStoredUserNameForDisplay(stored).split(' ')[0] ?? ''
}

/**
 * Build one person's appointment email.
 * The client reads "Your session..."; their clinician (or admins) read
 * "A session with S.R...." (initials only, for privacy).
 */
export function buildAppointmentEmail(
  recipient: EmailRecipient,
  info: AppointmentEmailInfo
): EmailMessage {
  const isClient = recipient.id === info.clientUserId
  const count = info.count ?? 1
  const series = count > 1
  const client = info.clientInitials || 'a client'

  let subject: string
  let intro: string
  let details: { label: string; value: string }[]

  switch (info.kind) {
    case 'BOOKED':
      subject = series ? 'Recurring sessions booked' : 'Session booked'
      intro = isClient
        ? series
          ? `Your ${count} recurring sessions are booked.`
          : 'Your session is booked.'
        : series
          ? `${count} recurring sessions with ${client} are booked.`
          : `A session with ${client} is booked.`
      details = [{ label: series ? 'First session' : 'When', value: info.when }]
      break

    case 'RESCHEDULED':
      subject = series ? 'Recurring sessions rescheduled' : 'Session rescheduled'
      intro = isClient
        ? series
          ? 'Your recurring sessions have been moved.'
          : 'Your session has been moved.'
        : series
          ? `Recurring sessions with ${client} have been moved.`
          : `A session with ${client} has been moved.`
      details = [{ label: 'New time', value: info.when }]
      if (info.previousWhen) details.push({ label: 'Previous time', value: info.previousWhen })
      break

    case 'CANCELLED':
      subject = series ? 'Recurring sessions cancelled' : 'Session cancelled'
      intro = isClient
        ? series
          ? `${count} of your recurring sessions have been cancelled.`
          : 'Your session has been cancelled.'
        : series
          ? `${count} recurring sessions with ${client} have been cancelled.`
          : `A session with ${client} has been cancelled.`
      details = [{ label: series ? 'Starting from' : 'Was scheduled for', value: info.when }]
      break

    case 'REMINDER':
      subject = 'Session reminder'
      intro = isClient
        ? 'This is a reminder about your upcoming session.'
        : `Reminder: your session with ${client} is coming up.`
      details = [{ label: 'When', value: info.when }]
      break
  }

  return {
    subject,
    greetingName: firstName(recipient.name),
    intro,
    details,
    button: CALENDAR_BUTTON,
    closing: isClient ? 'If you need to make a change, please contact the clinic.' : undefined,
  }
}

/**
 * Email everyone about an appointment, each with their own version.
 * Looks up the client's initials so callers don't have to.
 */
export async function sendAppointmentEmails(
  recipientIds: string[],
  info: Omit<AppointmentEmailInfo, 'clientInitials'>
): Promise<void> {
  const clientUser = await prisma.user.findUnique({
    where: { id: info.clientUserId },
    select: { name: true },
  })
  const clientInitials = formatStoredUserNameInitials(clientUser?.name ?? '')
  await emailUsers(recipientIds, (r) => buildAppointmentEmail(r, { ...info, clientInitials }))
}