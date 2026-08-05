// =============================================================================
// POST /api/credits/google-play/verify
//
// Android/TWA client sends a Play Billing purchase (productId + purchaseToken)
// here after a successful Digital Goods API / Payment Request API purchase.
// Credits are NEVER granted on the client — this route is the sole authority:
// it re-verifies the purchase against the Google Play Developer API, and only
// grants credits once Google itself confirms purchaseState === PURCHASED.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { isValidGooglePlayProduct, getCreditsForGooglePlayProduct } from '@/lib/payments/google-play-products'
import {
  verifyGooglePlayPurchase,
  acknowledgeGooglePlayPurchase,
  consumeGooglePlayPurchase,
  GooglePlayVerificationError,
} from '@/lib/payments/google-play-verification'
import { getPackageName } from '@/lib/payments/google-play-auth'
import { grantCredits, WalletError } from '@/lib/credits/credit-wallet'

const bodySchema = z.object({
  productId: z.string().min(1),
  purchaseToken: z.string().min(10),
})

// Play purchaseState: 0 = Purchased, 1 = Cancelled, 2 = Pending
const PURCHASE_STATE_PURCHASED = 0
const PURCHASE_STATE_CANCELLED = 1
const PURCHASE_STATE_PENDING = 2

function maskToken(token: string): string {
  if (token.length <= 12) return '***'
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  const rateLimit = checkRateLimit(`credits-verify:${auth.userId}`, 10, 60_000)
  if (!rateLimit.allowed) {
    return apiError('Too many purchase verification attempts. Please wait a moment and try again.', {
      status: 429,
      code: 'RATE_LIMITED',
    })
  }

  const body = await parseJsonBody(req)
  if (!body.ok) return body.response

  const parsed = bodySchema.safeParse(body.data)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  const { productId, purchaseToken } = parsed.data

  if (!isValidGooglePlayProduct(productId)) {
    return apiError('Unknown product ID', { status: 400, code: 'INVALID_PRODUCT' })
  }

  const credits = getCreditsForGooglePlayProduct(productId)
  if (!credits) {
    return apiError('Unknown product ID', { status: 400, code: 'INVALID_PRODUCT' })
  }

  // ── Idempotency / dedupe: has this exact token already been processed? ──────
  const existing = await prisma.googlePlayPurchase.findUnique({ where: { purchaseToken } })
  if (existing && (existing.status === 'GRANTED' || existing.status === 'CONSUMED')) {
    const wallet = await prisma.creditWallet.findUnique({ where: { userId: auth.userId }, select: { balance: true } })
    return NextResponse.json({
      data: { status: 'ALREADY_GRANTED', creditsGranted: existing.creditsGranted, balance: wallet?.balance ?? 0 },
    })
  }
  if (existing && (existing.status === 'REFUNDED' || existing.status === 'REVOKED')) {
    return apiError('This purchase has already been refunded or revoked.', { status: 409, code: 'PURCHASE_REVOKED' })
  }

  const purchaseRow = existing
    ?? await prisma.googlePlayPurchase.create({
      data: {
        userId: auth.userId,
        productId,
        purchaseToken,
        creditsGranted: 0,
        status: 'RECEIVED',
      },
    })

  // ── Server-to-server verification — the only source of truth ────────────────
  let verified
  try {
    verified = await verifyGooglePlayPurchase({ productId, purchaseToken, packageName: getPackageName() })
  } catch (err) {
    await prisma.googlePlayPurchase.update({ where: { id: purchaseRow.id }, data: { status: 'FAILED' } })
    if (err instanceof GooglePlayVerificationError) {
      logApiError('credits/google-play/verify', 'verifyGooglePlayPurchase', err, {
        userId: auth.userId,
        productId,
        purchaseToken: maskToken(purchaseToken),
      })
      const status = err.code === 'PACKAGE_MISMATCH' ? 403 : err.code === 'INVALID_TOKEN' ? 400 : 502
      return apiError(err.message, { status, code: err.code })
    }
    throw err
  }

  await prisma.googlePlayPurchase.update({
    where: { id: purchaseRow.id },
    data: {
      orderId: verified.orderId || null,
      purchaseState: String(verified.purchaseState),
      acknowledgementState: String(verified.acknowledgementState),
      consumptionState: String(verified.consumptionState),
      status: 'VERIFIED',
      rawPayload: verified as any,
    },
  })

  if (verified.purchaseState === PURCHASE_STATE_CANCELLED) {
    await prisma.googlePlayPurchase.update({ where: { id: purchaseRow.id }, data: { status: 'FAILED' } })
    return NextResponse.json({ data: { status: 'CANCELLED', creditsGranted: 0 } })
  }

  if (verified.purchaseState === PURCHASE_STATE_PENDING) {
    // Do not grant credits yet. The client should re-submit this token (e.g.
    // via the Digital Goods API's listPurchases() on next app resume) once
    // the pending payment method clears.
    return NextResponse.json({ data: { status: 'PENDING', creditsGranted: 0 } })
  }

  if (verified.purchaseState !== PURCHASE_STATE_PURCHASED) {
    return apiError('Unrecognized purchase state from Google Play', { status: 502, code: 'UNKNOWN_PURCHASE_STATE' })
  }

  // ── Grant credits (idempotent on purchaseToken via grantCredits' own check) ─
  let wallet
  try {
    wallet = await grantCredits({
      userId: auth.userId,
      amount: credits,
      provider: 'GOOGLE_PLAY',
      type: 'PURCHASE',
      idempotencyKey: `google-play:${purchaseToken}`,
      productId,
      purchaseToken,
      orderId: verified.orderId || undefined,
      metadata: { source: 'google_play_billing' },
    })
  } catch (err) {
    if (err instanceof WalletError && err.code === 'DUPLICATE_PURCHASE_TOKEN') {
      // Another request already granted this token concurrently — idempotent success.
      const currentWallet = await prisma.creditWallet.findUnique({ where: { userId: auth.userId }, select: { balance: true } })
      return NextResponse.json({ data: { status: 'ALREADY_GRANTED', creditsGranted: credits, balance: currentWallet?.balance ?? 0 } })
    }
    logApiError('credits/google-play/verify', 'grantCredits', err, { userId: auth.userId, purchaseToken: maskToken(purchaseToken) })
    return apiError('Failed to grant credits for this purchase', { status: 500, code: 'GRANT_FAILED' })
  }

  await prisma.googlePlayPurchase.update({
    where: { id: purchaseRow.id },
    data: { status: 'GRANTED', creditsGranted: credits },
  })

  // ── Acknowledge + consume — best-effort. Credits are already granted, so a
  // failure here does not roll anything back; it is logged for manual/RTDN
  // follow-up. Play auto-refunds unacknowledged purchases after ~3 days, so
  // this should be monitored (see GOOGLE_PLAY_BILLING_SETUP.md).
  try {
    await acknowledgeGooglePlayPurchase(purchaseToken, productId, getPackageName())
    await consumeGooglePlayPurchase(purchaseToken, productId, getPackageName())
    await prisma.googlePlayPurchase.update({ where: { id: purchaseRow.id }, data: { status: 'CONSUMED' } })
  } catch (err) {
    logApiError('credits/google-play/verify', 'acknowledgeOrConsume', err, { userId: auth.userId, purchaseToken: maskToken(purchaseToken) })
  }

  return NextResponse.json({ data: { status: 'GRANTED', creditsGranted: credits, balance: wallet.balance } })
}
