import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function loadKey(): Buffer {
  const raw = process.env.MESSAGE_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('MESSAGE_ENCRYPTION_KEY is not set')
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_LENGTH) {
    throw new Error('MESSAGE_ENCRYPTION_KEY must be 32 bytes, base64-encoded')
  }
  return key
}

/** Encrypts message text. The returned string is safe to store; it is not readable as plaintext. */
export function encryptMessage(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

/** Decrypts a value produced by encryptMessage. Rejects anything that was changed after encryption. */
export function decryptMessage(payload: string): string {
  const parts = payload.split(':')
  const [version, ivPart, tagPart, dataPart] = parts
  if (
    parts.length !== 4 ||
    version !== 'v1' ||
    ivPart === undefined ||
    tagPart === undefined ||
    dataPart === undefined
  ) {
    throw new Error('Message ciphertext is not a valid payload')
  }
  const iv = Buffer.from(ivPart, 'base64')
  const tag = Buffer.from(tagPart, 'base64')
  const data = Buffer.from(dataPart, 'base64')
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Message ciphertext is not a valid payload')
  }

  const decipher = createDecipheriv(ALGORITHM, loadKey(), iv)
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Message ciphertext failed authentication')
  }
}
