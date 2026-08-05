// =============================================================================
// GET /api/credits/google-play/purchases
//
// Returns the authenticated user's Google Play purchase history from our own
// records. Used for an in-app "purchase history" view.
//
// Note: this is not the mechanism that restores an *unverified* purchase
// after a reinstall/crash — that relies on the client re-querying Play's
// Digital Goods API listPurchases() on app resume and resubmitting any
// unresolved tokens to POST /api/credits/google-play/verify (which is
// idempotent per purchaseToken). This route only reflects purchases this
// server has already seen.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const purchases = await prisma.googlePlayPurchase.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        orderId: true,
        status: true,
        creditsGranted: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      data: purchases.map(p => ({
        id: p.id,
        productId: p.productId,
        orderId: p.orderId,
        status: p.status,
        creditsGranted: p.creditsGranted,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    logApiError('credits/google-play/purchases', 'listPurchases', err, { userId: auth.userId })
    return apiError('Failed to retrieve purchase history', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
