import nodemailer from 'nodemailer'
import { prisma } from './prisma'

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[mail] EMAIL_USER or EMAIL_PASS not set; email skipped')
    return null
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  })
}

export async function getAdminNotificationEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  })
  return admins.map((a) => a.email)
}

/** True when outbound app email (Gmail) env is set (same check as send path). */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS)
}

export async function sendAppEmail(opts: {
  to: string | string[]
  subject: string
  html: string
}): Promise<void> {
  const transporter = getTransporter()
  if (!transporter || !process.env.EMAIL_USER) return
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })
}

export async function sendAppointmentConfirmationEmail(opts: {
  to: string
  startTime: Date
  endTime: Date
  location?: string | null
  clientName?: string | null
}): Promise<void> {
  const clientName = opts.clientName?.trim()
  const greeting = clientName ? `<p>Hello ${escapeHtml(clientName)},</p>` : ''
  const location = opts.location?.trim()
  const locationHtml = location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ''

  await sendAppEmail({
    to: opts.to,
    subject: '[HCH] Appointment confirmed',
    html: `
      ${greeting}
      <p>Your appointment has been confirmed.</p>
      <p><strong>Time:</strong> ${escapeHtml(formatAppointmentTimeRange(opts.startTime, opts.endTime))}</p>
      ${locationHtml}
      <p>Sign in to the client portal and open <strong>Calendar</strong> to see your confirmed appointment.</p>
    `,
  })
}

export function formatAppointmentTimeRange(start: Date, end: Date): string {
  const date = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(start)
  const startTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(start)
  const endTime = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(end)
  return `${date} · ${startTime} – ${endTime}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
