// =============================================================================
// GET /api/admin/credits/wallets/:userId/ledger
// Admin-only: full CreditTransaction ledger history for one user — the
// audit trail an admin reviews when a wallet has gone negative (debt model,
// see credit-wallet.ts's refundCredits) or when investigating a dispute.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  const { userId } = params
  if (!userId) {
    return apiError('userId is required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  try {
    const [wallet, transactions] = await Promise.all([
      prisma.creditWallet.findUnique({
        where: { userId },
        select: { id: true, balance: true, lifetimePurchased: true, lifetimeSpent: true },
      }),
      prisma.creditTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          id: true,
          type: true,
          provider: true,
          amount: true,
          balanceBefore: true,
          balanceAfter: true,
          productId: true,
          purchaseToken: true,
          orderId: true,
          idempotencyKey: true,
          metadata: true,
          createdAt: true,
        },
      }),
    ])

    if (!wallet) {
      return apiError('No wallet found for this user', { status: 404, code: 'NOT_FOUND' })
    }

    return NextResponse.json({
      data: {
        wallet,
        transactions: transactions.map(t => ({ ...t, createdAt: t.createdAt.toISOString() })),
      },
    })
  } catch (err) {
    logApiError('admin/credits/wallets/ledger', 'GET', err, { userId })
    return apiError('Failed to load ledger', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
