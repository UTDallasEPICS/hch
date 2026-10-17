import { createError } from 'h3'

/** Shared by the client send route (#162) and the admin reply route (#163). */
export const MESSAGE_MAX_LENGTH = 5000

/** Trims message text and rejects empty or over-limit values with a 400. */
export function parseMessageText(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Message text is required' })
  }
  const text = raw.trim()
  if (!text) {
    throw createError({ statusCode: 400, statusMessage: 'Message text is required' })
  }
  if (text.length > MESSAGE_MAX_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Message text must be at most ${MESSAGE_MAX_LENGTH} characters`,
    })
  }
  return text
}
