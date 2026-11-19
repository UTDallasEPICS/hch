import { describe, it, expect, vi } from 'vitest'

// appointment-emails.ts imports the real prisma client, which needs a database.
// These tests only check the wording, so prisma is replaced with an empty stand-in.
vi.mock('./prisma', () => ({ prisma: {} }))
// email-logo.ts reads the logo file through Nuxt's server, which isn't running in tests.
vi.mock('./email-logo', () => ({ LOGO_CID: 'hch-logo', getLogoAttachment: async () => null }))

import { buildAppointmentEmail, type AppointmentEmailInfo } from './appointment-emails'
import { buildEmailHtml } from './email-template'

const client = { id: 'client-1', email: 'c@x.com', name: 'sam||rivera', role: 'CLIENT' }
const clinician = { id: 'clin-1', email: 'd@x.com', name: 'dana||lee', role: 'CLINICIAN' }
const admin = { id: 'admin-1', email: 'a@x.com', name: 'alex||kim', role: 'ADMIN' }

const booked: AppointmentEmailInfo = {
  kind: 'BOOKED',
  clientUserId: 'client-1',
  clientInitials: 'S.R.',
  clinicianName: 'Dana Lee',
  when: 'Mon, Oct 27, 3:00 PM',
}

describe('buildAppointmentEmail', () => {
  it('client sees their clinician by name', () => {
    const email = buildAppointmentEmail(client, booked)
    expect(email.intro).toBe('You have a session booked with Dana Lee.')
    expect(email.greetingName).toBe('Sam')
  })

  it('clinician sees the client by initials only', () => {
    const email = buildAppointmentEmail(clinician, booked)
    expect(email.intro).toBe('You have a session booked with S.R.')
    expect(JSON.stringify(email)).not.toMatch(/Sam|Rivera/)
  })

  it('admins get a note when no clinician is assigned', () => {
    const email = buildAppointmentEmail(admin, { ...booked, clinicianName: '' })
    expect(email.intro).toBe(
      'A session with S.R. has been booked. No clinician is assigned to this client yet.'
    )
    expect(JSON.stringify(email)).not.toMatch(/Sam|Rivera/)
  })

  it('reschedule shows the new and previous time', () => {
    const email = buildAppointmentEmail(client, {
      ...booked,
      kind: 'RESCHEDULED',
      previousWhen: 'Fri, Oct 24, 3:00 PM',
    })
    expect(email.subject).toBe('Session rescheduled')
    expect(email.details).toEqual([
      { label: 'New time', value: 'Mon, Oct 27, 3:00 PM' },
      { label: 'Previous time', value: 'Fri, Oct 24, 3:00 PM' },
    ])
  })

  it('a recurring series uses the series wording', () => {
    const email = buildAppointmentEmail(client, { ...booked, kind: 'CANCELLED', count: 4 })
    expect(email.subject).toBe('Recurring sessions cancelled')
    expect(email.intro).toBe('Your 4 recurring sessions with Dana Lee have been cancelled.')
  })

  it('only the client gets the "contact the clinic" line', () => {
    expect(buildAppointmentEmail(client, booked).closing).toBeTruthy()
    expect(buildAppointmentEmail(clinician, booked).closing).toBeUndefined()
  })
})

describe('buildEmailHtml', () => {
  it('escapes HTML in names and text', () => {
    const html = buildEmailHtml({ greetingName: '<b>Sam</b>', intro: 'Tom & "Jerry"' })
    expect(html).not.toContain('<b>Sam</b>')
    expect(html).toContain('&lt;b&gt;Sam&lt;/b&gt;')
    expect(html).toContain('Tom &amp; &quot;Jerry&quot;')
  })

  it('shows the logo inline', () => {
    expect(buildEmailHtml({ intro: 'Hi' })).toContain('src="cid:')
  })
})