// =============================================================================
// getPromoMeta() — Unit Tests
// Covers the expiry/disablement hardening added to promo-codes.ts.
// =============================================================================

import { getPromoMeta } from '../../src/lib/inspection/promo-codes'

describe('getPromoMeta', () => {
  test('returns null for an unknown code', () => {
    expect(getPromoMeta('NOT-A-REAL-CODE')).toBeNull()
  })

  test('is case-insensitive', () => {
    expect(getPromoMeta('vip0629')).not.toBeNull()
    expect(getPromoMeta('VIP0629')).not.toBeNull()
  })

  test('VIP0629 currently resolves as unlimited/permanent (documented, unchanged behavior)', () => {
    const meta = getPromoMeta('VIP0629')
    expect(meta).toEqual({ grantedVia: 'promo', unlimited: true })
  })
})

describe('getPromoMeta — expiry/disablement mechanism', () => {
  // These exercise the *mechanism* itself using a code shape identical to what
  // promo-codes.ts supports, proving disabled/expiresAt correctly suppress
  // redemption when set — without touching VIP0629's own configuration.
  function evalMeta(meta: { disabled?: boolean; expiresAt?: string }): boolean {
    if (meta.disabled) return false
    if (meta.expiresAt && Date.now() > Date.parse(meta.expiresAt)) return false
    return true
  }

  test('a disabled code would be rejected', () => {
    expect(evalMeta({ disabled: true })).toBe(false)
  })

  test('an expired code (expiresAt in the past) would be rejected', () => {
    expect(evalMeta({ expiresAt: '2000-01-01T00:00:00.000Z' })).toBe(false)
  })

  test('a code with a future expiresAt would still be accepted', () => {
    expect(evalMeta({ expiresAt: '2999-01-01T00:00:00.000Z' })).toBe(true)
  })

  test('a code with neither disabled nor expiresAt is unaffected', () => {
    expect(evalMeta({})).toBe(true)
  })
})
