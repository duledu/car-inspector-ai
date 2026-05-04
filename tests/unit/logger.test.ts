// =============================================================================
// Logger — Unit Tests
// Tests generateRequestId and parseRequestId (T5.2: requestId synchronization).
// Run: npx jest tests/unit/logger.test.ts
// =============================================================================

import { generateRequestId, parseRequestId } from '../../src/lib/logger'

describe('generateRequestId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateRequestId()).toBe('string')
    expect(generateRequestId().length).toBeGreaterThan(0)
  })

  it('returns a string accepted by parseRequestId', () => {
    // Every generated id must be self-consistent with the validator.
    for (let i = 0; i < 20; i += 1) {
      const id = generateRequestId()
      expect(parseRequestId(id)).toBe(id)
    }
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 100 }, generateRequestId))
    expect(ids.size).toBe(100)
  })
})

describe('parseRequestId', () => {
  // ─── Valid inputs ────────────────────────────────────────────────────────────

  it('accepts a valid 8-char lowercase hex string', () => {
    expect(parseRequestId('a1b2c3d4')).toBe('a1b2c3d4')
  })

  it('accepts a valid 8-char uppercase hex string', () => {
    expect(parseRequestId('A1B2C3D4')).toBe('A1B2C3D4')
  })

  it('accepts a string with hyphens', () => {
    expect(parseRequestId('abc-1234')).toBe('abc-1234')
  })

  it('accepts a string with underscores', () => {
    expect(parseRequestId('abc_1234')).toBe('abc_1234')
  })

  it('accepts a 4-char minimum string', () => {
    expect(parseRequestId('ab12')).toBe('ab12')
  })

  it('accepts a 64-char maximum string', () => {
    const id = 'a'.repeat(64)
    expect(parseRequestId(id)).toBe(id)
  })

  it('accepts a mixed-case alphanumeric string', () => {
    expect(parseRequestId('AbCd1234XyZ0')).toBe('AbCd1234XyZ0')
  })

  // ─── Invalid inputs ──────────────────────────────────────────────────────────

  it('returns null for null', () => {
    expect(parseRequestId(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(parseRequestId(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseRequestId('')).toBeNull()
  })

  it('returns null for a 3-char string (too short)', () => {
    expect(parseRequestId('ab1')).toBeNull()
  })

  it('returns null for a 65-char string (too long)', () => {
    expect(parseRequestId('a'.repeat(65))).toBeNull()
  })

  it('returns null for a string with a space', () => {
    expect(parseRequestId('abc 1234')).toBeNull()
  })

  it('returns null for a string with a colon (log-injection risk)', () => {
    expect(parseRequestId('abc:1234')).toBeNull()
  })

  it('returns null for a string with a newline (log-injection risk)', () => {
    expect(parseRequestId('abc\n1234')).toBeNull()
  })

  it('returns null for a string with a period', () => {
    expect(parseRequestId('abc.1234')).toBeNull()
  })

  it('returns null for a string with angle brackets', () => {
    expect(parseRequestId('<script>')).toBeNull()
  })

  it('returns null for a string with a slash', () => {
    expect(parseRequestId('abc/def')).toBeNull()
  })

  it('returns null for a non-string number', () => {
    expect(parseRequestId(12345678 as any)).toBeNull()
  })

  it('returns null for a non-string object', () => {
    expect(parseRequestId({} as any)).toBeNull()
  })
})
