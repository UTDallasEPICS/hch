import { describe, expect, it } from 'vitest'
import { MESSAGE_MAX_LENGTH, parseMessageText } from './message-text'

describe('parseMessageText', () => {
  it('trims surrounding whitespace', () => {
    expect(parseMessageText('  hello  ')).toBe('hello')
  })

  it('rejects empty and whitespace-only text', () => {
    expect(() => parseMessageText('   ')).toThrow(/Message text is required/)
    expect(() => parseMessageText('')).toThrow(/Message text is required/)
  })

  it('rejects text over the shared limit', () => {
    expect(() => parseMessageText('a'.repeat(MESSAGE_MAX_LENGTH + 1))).toThrow(
      /at most 5000 characters/,
    )
  })

  it('accepts text at the limit', () => {
    const text = 'a'.repeat(MESSAGE_MAX_LENGTH)
    expect(parseMessageText(text)).toBe(text)
  })
})
