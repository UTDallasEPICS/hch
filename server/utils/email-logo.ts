import { useStorage } from 'nitropack/runtime'
import type { EmailAttachment } from './mail'

/** The ID the email HTML uses to show the logo: <img src="cid:hch-logo"> */
export const LOGO_CID = 'hch-logo'

// Read the file once and reuse it, instead of reading it for every email.
let cached: EmailAttachment | null | undefined

/**
 * The HCH logo as an email attachment, or null if it can't be loaded.
 * Emails still send without it; the header just shows the alt text.
 */
export async function getLogoAttachment(): Promise<EmailAttachment | null> {
  if (cached !== undefined) return cached
  try {
    const raw = await useStorage('assets:server').getItemRaw('email/hch-logo.png')
    cached = raw ? { filename: 'hch-logo.png', content: Buffer.from(raw), cid: LOGO_CID } : null
  } catch (err) {
    console.warn('[email] could not load logo', err)
    cached = null
  }
  return cached
}