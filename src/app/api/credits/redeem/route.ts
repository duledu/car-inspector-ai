// =============================================================================
// POST /api/credits/redeem
//
// Spends wallet credits to unlock a premium product for a specific vehicle —
// the Android-only equivalent of Stripe checkout. Only products present in
// product-credit-costs.ts's CREDIT_UNLOCKABLE_PRODUCTS map can be redeemed;
// everything else (today: CARVERTICAL_REPORT) is rejected explicitly.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { verifyVehicleOwnership } from '@/lib/inspection/access'
import { getCreditCost } from '@/lib/credits/product-credit-costs'
import { spendCredit, refundCredits, WalletError } from '@/lib/credits/credit-wallet'
import { grantPremiumAccess } from '@/lib/payments/premium-access'
import { getProductPrice } from '@/modules/payments/pricing'
import { requireCurrentConsent } from '@/lib/legal/consent-guard'

const bodySchema = z.object({
  vehicleId: z.string().min(1),
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE', 'INSPECTION_REPORT']),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  // Redeeming a credit unlocks inspection-related functionality — gated the
  // same as starting an inspection would be. Purely additive: runs before
  // any wallet/entitlement mutation, so it cannot affect the already-verified
  // spend/refund/debt logic below.
  const consentBlock = await requireCurrentConsent(auth.userId)
  if (consentBlock) return consentBlock

  const rateLimit = checkRateLimit(`credits-redeem:${auth.userId}`, 10, 60_000)
  if (!rateLimit.allowed) {
    return apiError('Too many redemption attempts. Please wait a moment and try again.', { status: 429, code: 'RATE_LIMITED' })
  }

  const body = await parseJsonBody(req)
  if (!body.ok) return body.response

  const parsed = bodySchema.safeParse(body.data)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  const { vehicleId, productType } = parsed.data

  const ownsVehicle = await verifyVehicleOwnership(auth.userId, vehicleId)
  if (!ownsVehicle) {
    return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
  }

  const cost = getCreditCost(productType)
  if (cost === null) {
    return apiError(
      `${productType} is not available for purchase in the Android app.`,
      { status: 400, code: 'PRODUCT_NOT_AVAILABLE_ON_ANDROID' },
    )
  }

  const existing = await prisma.premiumPurchase.findFirst({
    where: { userId: auth.userId, vehicleId, productType: productType as any },
    select: { id: true, status: true },
  })
  if (existing?.status === 'PAID') {
    return apiError('This report has already been purchased.', { status: 409, code: 'ALREADY_PURCHASED' })
  }

  const idempotencyKey = `redeem:${auth.userId}:${vehicleId}:${productType}`

  let walletAfterSpend
  try {
    walletAfterSpend = await spendCredit({
      userId: auth.userId,
      idempotencyKey,
      amount: cost,
      productId: `unlock:${productType}`,
      metadata: { vehicleId, productType },
    })
  } catch (err) {
    if (err instanceof WalletError && (err.code === 'INSUFFICIENT_CREDITS' || err.code === 'WALLET_NOT_FOUND')) {
      return apiError('Not enough credits for this purchase.', { status: 402, code: 'INSUFFICIENT_CREDITS' })
    }
    if (err instanceof WalletError && err.code === 'NEGATIVE_BALANCE_DEBT') {
      return apiError(
        'Your account has an outstanding balance adjustment from a refund. Purchase credits to clear it before redeeming.',
        { status: 402, code: 'NEGATIVE_BALANCE_DEBT' },
      )
    }
    logApiError('credits/redeem', 'spendCredit', err, { userId: auth.userId, vehicleId, productType })
    return apiError('Failed to spend credits for this purchase', { status: 500, code: 'INTERNAL_ERROR' })
  }

  try {
    const price = getProductPrice(productType)
    const purchase = await prisma.premiumPurchase.upsert({
      where: { userId_vehicleId_productType: { userId: auth.userId, vehicleId, productType: productType as any } },
      update: { status: 'PENDING', amountCents: price.amountCents, currency: price.currency },
      create: {
        userId: auth.userId,
        vehicleId,
        productType: productType as any,
        status: 'PENDING',
        amountCents: price.amountCents,
        currency: price.currency,
      },
    })

    const granted = await grantPremiumAccess(purchase.id, {
      provider: 'google_play_credits',
      eventType: 'credits.redeemed',
      payload: { vehicleId, productType, creditsCost: cost },
    })

    return NextResponse.json({
      data: {
        status: 'GRANTED',
        productType: granted.productType,
        vehicleId: granted.vehicleId,
        creditsSpent: cost,
        balance: walletAfterSpend.balance,
      },
    })
  } catch (err) {
    // Access was not granted despite a successful credit spend — refund the
    // credits so the user is never charged without receiving what they paid
    // for. Uses a distinct idempotency key so this refund can't collide with
    // (or be confused for) a real Google Play refund event.
    logApiError('credits/redeem', 'grantPremiumAccess', err, { userId: auth.userId, vehicleId, productType })
    try {
      await refundCredits({
        userId: auth.userId,
        amount: cost,
        idempotencyKey: `redeem-rollback:${idempotencyKey}`,
        metadata: { reason: 'grant_failed_after_spend', vehicleId, productType },
      })
    } catch (refundErr) {
      logApiError('credits/redeem', 'refundCredits (rollback)', refundErr, { userId: auth.userId, vehicleId, productType })
    }
    return apiError('Failed to grant access after spending credits. Your credits have been refunded.', {
      status: 500,
      code: 'GRANT_FAILED',
    })
  }
}
