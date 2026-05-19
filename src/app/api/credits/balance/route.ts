// GET /api/credits/balance
// Returns the authenticated user's current credit wallet snapshot.

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { getOrCreateWallet } from '@/lib/credits/credit-wallet'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const wallet = await getOrCreateWallet(auth.userId)
    return NextResponse.json({
      data: {
        balance: wallet.balance,
        lifetimePurchased: wallet.lifetimePurchased,
        lifetimeSpent: wallet.lifetimeSpent,
      },
    })
  } catch (err) {
    logApiError('credits/balance', 'getOrCreateWallet', err, { userId: auth.userId })
    return apiError('Failed to retrieve credit balance', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
