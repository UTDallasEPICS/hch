import { sendAppEmail, isEmailConfigured } from './mail'
import { getLogoAttachment, LOGO_CID } from './email-logo'

/** Escape text so it is safe to put inside HTML. */
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
  greetingName?: string // e.g. "Sam"; omitted → "Hello,"
  intro: string // main sentence
  details?: EmailDetail[] // shown as a small table
  button?: { label: string; path: string } // e.g. { label: 'Open Calendar', path: '/calendar' }
  closing?: string // last line
}

const APP_URL = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

// Brand colors (match the app's primary palette)
const BRAND = '#2d4a5f'
const BRAND_LIGHT = '#e8ecef'
const TEXT = '#1f2937'
const MUTED = '#6b7280'

/**
 * Build the email HTML. All inputs are PLAIN TEXT; everything is escaped here.
 * Uses tables + inline styles because many email apps (Gmail, Outlook)
 * ignore <style> blocks and modern CSS layout.
 */
export function buildEmailHtml(content: EmailContent): string {
  const name = content.greetingName?.trim()
  const greeting = name ? `Hello ${escapeHtml(name)},` : 'Hello,'

  const details = content.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;background:${BRAND_LIGHT};border-radius:8px;">
        ${content.details
          .map(
            (d) => `<tr>
              <td style="padding:8px 16px;color:${MUTED};font-size:14px;width:35%;">${escapeHtml(d.label)}</td>
              <td style="padding:8px 16px;color:${TEXT};font-size:14px;font-weight:600;">${escapeHtml(d.value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : ''

  const button = content.button
    ? `<p style="margin:24px 0;">
        <a href="${escapeHtml(APP_URL + content.button.path)}"
           style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:15px;">
          ${escapeHtml(content.button.label)}
        </a>
      </p>`
    : ''

  const closing = content.closing
    ? `<p style="margin:16px 0 0;color:${TEXT};font-size:15px;line-height:1.5;">${escapeHtml(content.closing)}</p>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:24px;border-bottom:4px solid ${BRAND};">
            <img src="cid:${LOGO_CID}" alt="Hope Cope Heal" width="200" style="display:block;width:200px;height:auto;border:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:${TEXT};font-size:16px;">${greeting}</p>
            <p style="margin:0;color:${TEXT};font-size:15px;line-height:1.5;">${escapeHtml(content.intro)}</p>
            ${details}
            ${button}
            ${closing}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;background:${BRAND_LIGHT};color:${MUTED};font-size:12px;line-height:1.5;">
            Hope Cope Heal<br>
            This is an automated message. Please don't reply to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

/**
 * Send an appointment notification email with the HCH logo header.
 * When SMTP isn't configured (local dev), logs that it was skipped.
 * Only subject + recipient count, never the body or addresses (client details).
 */
export async function sendNotificationEmail(
  opts: { to: string | string[]; subject: string } & EmailContent
): Promise<void> {
  const subject = `[HCH] ${opts.subject}`

  if (!isEmailConfigured()) {
    const count = Array.isArray(opts.to) ? opts.to.length : 1
    console.warn(`[email] skipped (SMTP not configured): "${subject}" to ${count} recipient(s)`)
    return
  }

  const logo = await getLogoAttachment()
  await sendAppEmail({
    to: opts.to,
    subject,
    html: buildEmailHtml(opts),
    attachments: logo ? [logo] : undefined,
  })
}