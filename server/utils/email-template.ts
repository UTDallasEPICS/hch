import { sendAppEmail, isEmailConfigured } from './mail'

/**
 * Escape text so it is safe to put inside HTML.
 * Replaces the 5 copies scattered across routes; also escapes ' (they don't).
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type EmailDetail = { label: string; value: string }

export type EmailContent = {
  greetingName?: string // e.g. client initials; omitted → "Hello,"
  intro: string // main sentence
  details?: EmailDetail[] // rendered as a bullet list
  closing?: string // last line
}

/** Build the email HTML. All inputs are PLAIN TEXT; everything is escaped here. */
export function buildEmailHtml(content: EmailContent): string {
  const name = content.greetingName?.trim()
  const greeting = name ? `<p>Hello ${escapeHtml(name)},</p>` : '<p>Hello,</p>'

  const intro = `<p>${escapeHtml(content.intro)}</p>`

  const details = content.details?.length
    ? `<ul>${content.details
        .map((d) => `<li><strong>${escapeHtml(d.label)}:</strong> ${escapeHtml(d.value)}</li>`)
        .join('')}</ul>`
    : ''

  const closing = content.closing ? `<p>${escapeHtml(content.closing)}</p>` : ''

  return [greeting, intro, details, closing].filter(Boolean).join('\n')
}

/**
 * Send an appointment notification email.
 * Adds the "[HCH] " subject prefix. When SMTP isn't configured (local dev),
 * logs that it was skipped. Only subject + recipient count, never the body
 * or addresses, since those contain client details.
 */
export async function sendNotificationEmail(
  opts: { to: string | string[]; subject: string } & EmailContent
): Promise<void> {
  const subject = `[HCH] ${opts.subject}`

  if (!isEmailConfigured()) {
    const count = Array.isArray(opts.to) ? opts.to.length : 1
    console.info(`[email] skipped (SMTP not configured): "${subject}" to ${count} recipient(s)`)
    return
  }

  await sendAppEmail({ to: opts.to, subject, html: buildEmailHtml(opts) })
}
