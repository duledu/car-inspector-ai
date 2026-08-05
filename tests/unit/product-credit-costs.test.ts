// =============================================================================
// Credit-Unlockable Products — Unit Tests
// =============================================================================

import {
  CREDIT_UNLOCKABLE_PRODUCTS,
  isCreditUnlockable,
  getCreditCost,
  listCreditUnlockableProducts,
} from '../../src/lib/credits/product-credit-costs'

describe('CREDIT_UNLOCKABLE_PRODUCTS', () => {
  test('native AI products are credit-unlockable with positive costs', () => {
    expect(getCreditCost('INSPECTION_REPORT')).toBe(1)
    expect(getCreditCost('AI_DEEP_SCAN')).toBe(2)
    expect(getCreditCost('FULL_INSPECTION_BUNDLE')).toBe(5)
  })

  test('CarVertical is excluded — not credit-unlockable, no cost', () => {
    expect(isCreditUnlockable('CARVERTICAL_REPORT')).toBe(false)
    expect(getCreditCost('CARVERTICAL_REPORT')).toBeNull()
  })

  test('isCreditUnlockable matches getCreditCost for every product', () => {
    const allProducts = ['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE', 'INSPECTION_REPORT'] as const
    for (const product of allProducts) {
      expect(isCreditUnlockable(product)).toBe(getCreditCost(product) !== null)
    }
  })

  test('every configured cost is a positive integer', () => {
    Object.values(CREDIT_UNLOCKABLE_PRODUCTS).forEach(cfg => {
      expect(cfg!.creditCost).toBeGreaterThan(0)
      expect(Number.isInteger(cfg!.creditCost)).toBe(true)
    })
  })

  test('listCreditUnlockableProducts returns exactly the configured keys', () => {
    const listed = listCreditUnlockableProducts().sort()
    const keys = Object.keys(CREDIT_UNLOCKABLE_PRODUCTS).sort()
    expect(listed).toEqual(keys)
    expect(listed).not.toContain('CARVERTICAL_REPORT')
  })
})
