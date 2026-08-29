// =============================================================================
// Product Entitlements — configuration-driven capability resolution
//
// grantPremiumAccess() (premium-access.ts) upserts one AccessGrant row per
// PremiumPurchase, scoped to that purchase's own productType. A bundle
// product (e.g. FULL_INSPECTION_BUNDLE) must unlock more than just its own
// name, though — this map is the single place that decides which purchased
// productTypes satisfy which capability, so adding a future bundle is a
// one-line addition here rather than a rewrite of every route that checks
// entitlement.
//
// Entitlement is always resolved from the AccessGrant table — never from a
// client-supplied productType or purchase claim.
// =============================================================================

import { prisma } from '@/config/prisma'
import type { PremiumProduct } from '@/types'

/**
 * For each capability, the purchased productTypes whose AccessGrant satisfies
 * it. CARVERTICAL_REPORT is checked directly elsewhere (premium/report route)
 * and included here only for completeness.
 */
const PRODUCTS_GRANTING: Record<PremiumProduct, PremiumProduct[]> = {
  AI_DEEP_SCAN: ['AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE'],
  INSPECTION_REPORT: ['INSPECTION_REPORT', 'FULL_INSPECTION_BUNDLE'],
  FULL_INSPECTION_BUNDLE: ['FULL_INSPECTION_BUNDLE'],
  CARVERTICAL_REPORT: ['CARVERTICAL_REPORT'],
}

/**
 * Returns true when `userId` holds an active, server-recorded entitlement to
 * `capability` for `vehicleId` — i.e. an AccessGrant row (isActive: true)
 * whose productType is one of the products that grant this capability.
 */
export async function hasEntitlement(
  userId: string,
  vehicleId: string,
  capability: PremiumProduct,
): Promise<boolean> {
  const grantingProducts = PRODUCTS_GRANTING[capability]
  const grant = await prisma.accessGrant.findFirst({
    where: { userId, vehicleId, isActive: true, productType: { in: grantingProducts } },
    select: { id: true },
  })
  return !!grant
}
