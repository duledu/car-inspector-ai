// =============================================================================
// AIResult.findings payload — parser safety and shape round-trip
//
// The single shared parser every persisted-findings consumer (scoring
// service, PDF route) must go through. Malformed/unexpected JSON must fail
// safely to an empty/unknown result, never throw and take down the report
// or scoring flow.
// =============================================================================

import { buildAIResultPayload, parseAIResultPayload } from '../../src/lib/inspection/ai-result-payload'
import type { AIFinding } from '../../src/types'

const finding: AIFinding = {
  id: 'f1', area: 'Rear', title: 'Scratch', description: 'd', severity: 'warning', confidence: 60,
}

describe('buildAIResultPayload / parseAIResultPayload — round trip', () => {
  it('round-trips items and counts through build -> parse', () => {
    const payload = buildAIResultPayload([finding], 8, 8, 0)
    const parsed = parseAIResultPayload(payload)
    expect(parsed.findings).toEqual([finding])
    expect(parsed.usableCount).toBe(8)
  })

  it('round-trips a clean, zero-findings, fully-usable batch (the case that previously carried no photo-count information at all)', () => {
    const payload = buildAIResultPayload([], 8, 8, 0)
    const parsed = parseAIResultPayload(payload)
    expect(parsed.findings).toEqual([])
    expect(parsed.usableCount).toBe(8)
  })
})

describe('parseAIResultPayload — legacy shape compatibility', () => {
  it('reads a legacy bare AIFinding[] array, with usableCount genuinely unknown (null, never guessed)', () => {
    const parsed = parseAIResultPayload([finding])
    expect(parsed.findings).toEqual([finding])
    expect(parsed.usableCount).toBeNull()
  })

  it('reads a legacy empty bare array the same way', () => {
    const parsed = parseAIResultPayload([])
    expect(parsed.findings).toEqual([])
    expect(parsed.usableCount).toBeNull()
  })
})

describe('parseAIResultPayload — fails safely on malformed/unexpected JSON, never throws', () => {
  const malformedInputs: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['a plain string', 'not json'],
    ['a number', 42],
    ['a boolean', true],
    ['an object with no items field', { foo: 'bar' }],
    ['an object whose items is not an array', { items: 'nope', usableCount: 8 }],
    ['an object whose usableCount is a string', { items: [finding], usableCount: '8' }],
    ['an object whose usableCount is NaN', { items: [finding], usableCount: NaN }],
    ['an empty object', {}],
  ]

  it.each(malformedInputs)('does not throw for: %s', (_label, input) => {
    expect(() => parseAIResultPayload(input)).not.toThrow()
  })

  it('malformed object shapes resolve to empty findings with unknown usableCount (conservative, never guessed)', () => {
    expect(parseAIResultPayload({ foo: 'bar' })).toEqual({ findings: [], usableCount: null })
    expect(parseAIResultPayload(null)).toEqual({ findings: [], usableCount: null })
    expect(parseAIResultPayload('not json')).toEqual({ findings: [], usableCount: null })
  })

  it('a non-numeric usableCount is treated as unknown, not coerced or trusted', () => {
    const parsed = parseAIResultPayload({ items: [finding], usableCount: '8' })
    expect(parsed.findings).toEqual([finding])
    expect(parsed.usableCount).toBeNull()
  })

  it('items that is present but not an array is treated as the unknown/legacy fallback rather than crashing on .flatMap or .filter downstream', () => {
    const parsed = parseAIResultPayload({ items: 'not-an-array', usableCount: 8 })
    expect(parsed.findings).toEqual([])
    expect(() => parsed.findings.flatMap((f) => f)).not.toThrow()
  })
})
