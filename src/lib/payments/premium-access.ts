// =============================================================================
// Premium Access Granting — shared by every payment source
//
// Extracted from payment.service.ts's onPaymentSucceeded so that Stripe
// (web) and Google Play credit redemption (Android) grant access through
// the exact same code path — one place decides what "paid" means for a
// PremiumPurchase row, regardless of which payment rail produced it.
// =============================================================================

import { prisma } from '@/config/prisma'
import { grantAccess } from '@/lib/inspection/access'
import { recordExternalPurchaseAudit } from '@/lib/credits/credit-wallet'
import type { PremiumProduct } from '@/types'

export interface GrantPremiumAccessResult {
  id: string
  userId: string
  vehicleId: string
  productType: PremiumProduct
}

/**
 * Marks a PremiumPurchase as PAID, upserts its AccessGrant, and — for
 * INSPECTION_REPORT — activates the InspectionReport row via the existing
 * access.ts grantAccess(). Records a PaymentEvent for audit history.
 *
 * `purchaseId` must reference an existing PremiumPurchase row (created by
 * the caller — Stripe's checkout flow or the credit-redeem route — before
 * this is called).
 */
export async function grantPremiumAccess(
  purchaseId: string,
  opts: { provider: string; eventType?: string; payload?: unknown },
): Promise<GrantPremiumAccessResult> {
  const purchase = await prisma.premiumPurchase.update({
    where: { id: purchaseId },
    data: { status: 'PAID', purchasedAt: new Date() },
  })

  await prisma.accessGrant.upsert({
    where: { purchaseId },
    update: { isActive: true, grantedAt: new Date() },
    create: {
      userId: purchase.userId,
      purchaseId: purchase.id,
      productType: purchase.productType,
      vehicleId: purchase.vehicleId,
      grantedAt: new Date(),
    },
  })

  if (purchase.productType === 'INSPECTION_REPORT') {
    await grantAccess(purchase.userId, purchase.vehicleId, {
      grantedVia: 'purchase',
      purchaseId: purchase.id,
    })
  }

  // Non-wallet-native payment rails (Stripe) still record an audit-only row
  // in the shared credit ledger, so CreditTransaction remains the single
  // cross-platform purchase history. This never touches CreditWallet.balance
  // — Stripe purchases keep granting access directly, above, exactly as
  // before. Google Play credit redemptions already wrote a real,
  // balance-affecting ledger entry when the credits were spent, so they are
  // not double-recorded here.
  if (opts.provider === 'stripe') {
    await recordExternalPurchaseAudit({
      userId: purchase.userId,
      idempotencyKey: `stripe-purchase-audit:${purchase.id}`,
      provider: 'STRIPE',
      productId: purchase.productType,
      metadata: { vehicleId: purchase.vehicleId, purchaseId: purchase.id },
    })
  }

  await prisma.paymentEvent.create({
    data: {
      purchaseId,
      userId: purchase.userId,
      eventType: opts.eventType ?? 'payment.succeeded',
      provider: opts.provider,
      payload: (opts.payload ?? {}) as any,
    },
  })

  return {
    id: purchase.id,
    userId: purchase.userId,
    vehicleId: purchase.vehicleId,
    productType: purchase.productType as PremiumProduct,
  }
}
