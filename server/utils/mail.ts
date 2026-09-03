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
