import nodemailer from 'nodemailer'

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

export function getAdminNotificationEmails(): string[] {
  const raw = process.env.INITIAL_ADMIN_EMAIL
  if (!raw) return []
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
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
