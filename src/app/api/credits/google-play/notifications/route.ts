// =============================================================================
// POST /api/credits/google-play/notifications
//
// Google Play Real-time Developer Notifications (RTDN) webhook — Pub/Sub push
// endpoint. Handles voided-purchase notifications (refunds/chargebacks) by
// reversing the wallet grant via the existing refundCredits() ledger function,
// mirroring how src/app/api/payment/webhook/route.ts handles Stripe events.
//
// Security (see GOOGLE_PLAY_BILLING_SETUP.md for full setup steps):
//   1. The request must carry a valid Google-signed OIDC bearer token proving
//      it genuinely came from the Pub/Sub push subscription configured for
//      this service account — verified via google-auth-library, not just a
//      shared secret. Fails closed if OIDC env vars are unset.
//   2. The shared-secret query token (?token=...) is kept as a cheap extra
//      filter, compared in constant time.
//   3. The notification BODY is never trusted on its own — before any wallet
//      debit, the claimed voided purchaseToken is independently re-confirmed
//      against Google's own purchases.voidedpurchases.list API.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '@/config/prisma'
import { logApiError } from '@/utils/api-response'
import { refundCredits } from '@/lib/credits/credit-wallet'
import { wasPurchaseVoided } from '@/lib/payments/google-play-verification'

interface VoidedPurchaseNotification {
  purchaseToken: string
  orderId?: string
  productType?: number
  refundType?: number
}

interface OneTimeProductNotification {
  version: string
  notificationType: number // 1 = PURCHASED, 2 = CANCELED
  purchaseToken: string
}

interface DeveloperNotification {
  packageName?: string
  voidedPurchaseNotification?: VoidedPurchaseNotification
  oneTimeProductNotification?: OneTimeProductNotification
}

const oidcClient = new OAuth2Client()

function maskToken(token: string): string {
  if (token.length <= 12) return '***'
  return `${token.slice(0, 6)}…${token.slice(-4)}`
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = new Uint8Array(Buffer.from(a))
  const bufB = new Uint8Array(Buffer.from(b))
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * Verifies the request carries a valid Google-issued OIDC token for the
 * Pub/Sub push subscription configured for this endpoint. Fails closed:
 * if the required env vars aren't set, this always returns false rather
 * than silently degrading to shared-secret-only auth.
 */
async function verifyPubSubOidcToken(authHeader: string | null): Promise<boolean> {
  const audience = process.env.GOOGLE_PLAY_RTDN_OIDC_AUDIENCE
  const expectedEmail = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL
  if (!audience || !expectedEmail) return false

  if (!authHeader?.startsWith('Bearer ')) return false
  const idToken = authHeader.slice('Bearer '.length)

  try {
    const ticket = await oidcClient.verifyIdToken({ idToken, audience })
    const payload = ticket.getPayload()
    if (!payload) return false
    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') return false
    if (payload.email !== expectedEmail) return false
    if (payload.email_verified !== true) return false
    return true
  } catch {
    return false
  }
}

// Pub/Sub always returns 2xx quickly to stop retries; failures are logged,
// not surfaced to the caller, since Play will keep resending on non-2xx.
function ack() {
  return NextResponse.json({ received: true })
}

async function handleVoidedPurchase(notification: VoidedPurchaseNotification) {
  const purchase = await prisma.googlePlayPurchase.findUnique({ where: { purchaseToken: notification.purchaseToken } })
  if (!purchase) {
    logApiError('credits/google-play/notifications', 'handleVoidedPurchase', new Error('Unknown purchaseToken'), {
      orderId: notification.orderId,
    })
    return
  }

  if (purchase.status !== 'GRANTED' && purchase.status !== 'CONSUMED') {
    // Nothing was ever granted for this token — no wallet reversal needed.
    await prisma.googlePlayPurchase.update({ where: { id: purchase.id }, data: { status: 'REVOKED' } })
    return
  }

  // Never trust the RTDN payload alone — independently confirm with Google
  // that this token genuinely appears in their own voided-purchases record
  // before debiting anyone's wallet. Fail closed on any doubt.
  let confirmed = false
  try {
    confirmed = await wasPurchaseVoided(notification.purchaseToken)
  } catch (err) {
    logApiError('credits/google-play/notifications', 'wasPurchaseVoided', err, {
      purchaseToken: maskToken(notification.purchaseToken),
    })
    return
  }
  if (!confirmed) {
    logApiError(
      'credits/google-play/notifications',
      'handleVoidedPurchase',
      new Error('Notification claimed a void that Google does not confirm — ignoring'),
      { purchaseToken: maskToken(notification.purchaseToken) },
    )
    return
  }

  await refundCredits({
    userId: purchase.userId,
    amount: purchase.creditsGranted,
    idempotencyKey: `google-play-void:${notification.purchaseToken}`,
    purchaseToken: notification.purchaseToken,
    metadata: { orderId: notification.orderId ?? null, refundType: notification.refundType ?? null, source: 'rtdn' },
  })

  await prisma.googlePlayPurchase.update({ where: { id: purchase.id }, data: { status: 'REVOKED' } })
}

async function handleOneTimeProductCancelled(notification: OneTimeProductNotification) {
  const purchase = await prisma.googlePlayPurchase.findUnique({ where: { purchaseToken: notification.purchaseToken } })
  if (!purchase || purchase.status === 'GRANTED' || purchase.status === 'CONSUMED') return
  await prisma.googlePlayPurchase.update({ where: { id: purchase.id }, data: { status: 'FAILED' } })
}

export async function POST(req: NextRequest) {
  const oidcOk = await verifyPubSubOidcToken(req.headers.get('authorization'))
  if (!oidcOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const expectedToken = process.env.GOOGLE_PLAY_RTDN_TOKEN
  const providedToken = req.nextUrl.searchParams.get('token')
  if (!expectedToken || !providedToken || !timingSafeEqualStrings(providedToken, expectedToken)) {
    // Do not leak whether the token was missing vs. wrong.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let envelope: { message?: { data?: string } }
  try {
    envelope = await req.json()
  } catch {
    return ack() // malformed body — nothing useful to retry
  }

  const raw = envelope.message?.data
  if (!raw) return ack()

  let notification: DeveloperNotification
  try {
    notification = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'))
  } catch (err) {
    logApiError('credits/google-play/notifications', 'parseNotification', err)
    return ack()
  }

  try {
    if (notification.voidedPurchaseNotification) {
      await handleVoidedPurchase(notification.voidedPurchaseNotification)
    } else if (notification.oneTimeProductNotification?.notificationType === 2) {
      await handleOneTimeProductCancelled(notification.oneTimeProductNotification)
    }
  } catch (err) {
    logApiError('credits/google-play/notifications', 'processNotification', err)
  }

  return ack()
}
