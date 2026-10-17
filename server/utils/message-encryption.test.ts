import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decryptMessage, encryptMessage } from './message-encryption'

const KEY = randomBytes(32).toString('base64')

beforeEach(() => {
  process.env.MESSAGE_ENCRYPTION_KEY = KEY
})

afterEach(() => {
  delete process.env.MESSAGE_ENCRYPTION_KEY
})

describe('message encryption', () => {
  it('stores text that is unreadable and decrypts back to the original', () => {
    const plaintext = 'Please call me about tomorrow.'
    const stored = encryptMessage(plaintext)

    expect(stored).not.toContain(plaintext)
    expect(stored.startsWith('v1:')).toBe(true)
    expect(decryptMessage(stored)).toBe(plaintext)
  })

  it('rejects ciphertext that was tampered with', () => {
    const stored = encryptMessage('hello')
    const [version, iv, tag, data] = stored.split(':')
    const flipped = Buffer.from(data, 'base64')
    flipped[0] = flipped[0] ^ 0xff

    expect(() => decryptMessage(`${version}:${iv}:${tag}:${flipped.toString('base64')}`)).toThrow(
      /failed authentication/,
    )
  })

  it('gives a clear error when the key is missing', () => {
    delete process.env.MESSAGE_ENCRYPTION_KEY
    expect(() => encryptMessage('hello')).toThrow(/MESSAGE_ENCRYPTION_KEY is not set/)
  })
})
