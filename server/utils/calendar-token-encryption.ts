import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getEncryptionKey(): Buffer {
  const encodedKey = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY
  if (!encodedKey) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY is not set')
  }

  const key = Buffer.from(encodedKey, 'base64')
  if (key.length !== 32) {
    throw new Error('CALENDAR_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key')
  }
  return key
}

export function encryptToken(plain: string): string {
  if (!plain) {
    throw new Error('Token to encrypt cannot be empty')
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

export function decryptToken(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted calendar token')
  }

  try {
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const ciphertext = Buffer.from(parts[2], 'base64')
    if (iv.length !== IV_LENGTH || authTag.length !== 16 || ciphertext.length === 0) {
      throw new Error('Malformed encrypted calendar token')
    }

    const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch (error) {
    throw new Error('Malformed or tampered encrypted calendar token', { cause: error })
  }
}
