// =============================================================================
// Google Play Product Mapping
// Maps Google Play product IDs to the number of inspection credits they grant.
// Add new products here — the verification flow picks them up automatically.
// =============================================================================

export const GOOGLE_PLAY_PRODUCTS: Record<string, number> = {
  inspection_credit_1: 1,
  inspection_credit_2: 2,
  inspection_credit_3: 3,
  inspection_credit_4: 4,
  inspection_credit_5: 5,
}

export type GooglePlayProductId = keyof typeof GOOGLE_PLAY_PRODUCTS

/**
 * Returns the number of credits granted for a given Google Play product ID,
 * or null if the product ID is not recognised.
 */
export function getCreditsForGooglePlayProduct(productId: string): number | null {
  const credits = GOOGLE_PLAY_PRODUCTS[productId]
  return typeof credits === 'number' ? credits : null
}

/**
 * Returns true if the product ID is a known Google Play inspection credit product.
 */
export function isValidGooglePlayProduct(productId: string): boolean {
  return productId in GOOGLE_PLAY_PRODUCTS
}
