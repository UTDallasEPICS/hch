import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptToken,
  encryptToken,
} from '../server/utils/calendar-token-encryption'

test('calendar tokens round trip with AES-256-GCM', () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(32, 7).toString('base64')

  assert.equal(decryptToken(encryptToken('google-access-token')), 'google-access-token')
})

test('calendar encryption uses a fresh IV for each ciphertext', () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(32, 11).toString('base64')

  const first = encryptToken('same-token')
  const second = encryptToken('same-token')
  assert.notEqual(first, second)
  assert.equal(decryptToken(first), 'same-token')
  assert.equal(decryptToken(second), 'same-token')
})

test('calendar token tampering is rejected', () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(32, 19).toString('base64')

  const encrypted = encryptToken('sensitive-token')
  const parts = encrypted.split(':')
  const tamperedBytes = Buffer.from(parts[2], 'base64')
  tamperedBytes[0] ^= 1
  parts[2] = tamperedBytes.toString('base64')

  assert.throws(
    () => decryptToken(parts.join(':')),
    /tampered|Malformed/
  )
})

test('calendar encryption requires a 32-byte base64 key', () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY =
    Buffer.alloc(16, 3).toString('base64')

  assert.throws(
    () => encryptToken('token'),
    /32-byte key/
  )
})
