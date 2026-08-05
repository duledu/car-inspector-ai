// =============================================================================
// Credit-Unlockable Products
// The single source of truth for which premium products can be unlocked with
// wallet credits on Android, and how many credits each one costs.
//
// This is the ONLY place that decides Android/Play-Billing product scope —
// the redeem route and purchase UI both read this map generically (loop /
// lookup), they never branch on a specific productType. Adding a future AI
// product to Android is a one-line addition here, not a code change.
//
// Only native, in-app-generated AI features are credit-unlockable. Third-party
// resold data products (e.g. CarVertical vehicle-history reports) are
// intentionally excluded — Google Play Billing is for digital goods this app
// itself produces, not for reselling another provider's data. CarVertical is
// simply absent from this map; it is not special-cased anywhere downstream.
//
// Costs are sized proportionally to the existing Stripe pricing in
// src/modules/payments/pricing.ts, which is untouched by Android billing.
// =============================================================================

import type { PremiumProduct } from '@/types'

export interface CreditUnlockableConfig {
  creditCost: number
}

export const CREDIT_UNLOCKABLE_PRODUCTS: Partial<Record<PremiumProduct, CreditUnlockableConfig>> = {
  INSPECTION_REPORT:      { creditCost: 1 }, // reference: EUR 4.99 Stripe price
  AI_DEEP_SCAN:           { creditCost: 2 }, // reference: EUR 9.99 Stripe price
  FULL_INSPECTION_BUNDLE: { creditCost: 5 }, // reference: EUR 24.99 Stripe price
  // CARVERTICAL_REPORT — deliberately omitted. Not a native AI feature, not
  // available for purchase in the Android app.
}

export function isCreditUnlockable(productType: PremiumProduct): boolean {
  return productType in CREDIT_UNLOCKABLE_PRODUCTS
}

export function getCreditCost(productType: PremiumProduct): number | null {
  return CREDIT_UNLOCKABLE_PRODUCTS[productType]?.creditCost ?? null
}

/** All product types currently purchasable with credits, for UI listings. */
export function listCreditUnlockableProducts(): PremiumProduct[] {
  return Object.keys(CREDIT_UNLOCKABLE_PRODUCTS) as PremiumProduct[]
}
