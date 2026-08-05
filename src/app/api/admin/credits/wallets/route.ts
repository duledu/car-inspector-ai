// =============================================================================
// GET /api/admin/credits/wallets
// Admin-only review surface for the credit-wallet debt model (see
// refundCredits in credit-wallet.ts): lets an admin see which wallets have
// gone negative after a refund exceeded the spendable balance, so it can be
// followed up on manually if needed.
//
// Query params:
//   negativeOnly=true  — only wallets with balance < 0
//   take               — page size, default 50, max 200
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAdmin } from '@/lib/admin/admin-guard'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest) {
  const guard = await requireAdmin(req)
  if (!guard.success) return guard.response

  const negativeOnly = req.nextUrl.searchParams.get('negativeOnly') === 'true'
  const takeParam = Number(req.nextUrl.searchParams.get('take') ?? '50')
  const take = Number.isFinite(takeParam) ? Math.min(Math.max(1, takeParam), 200) : 50

  try {
    const wallets = await prisma.creditWallet.findMany({
      where: negativeOnly ? { balance: { lt: 0 } } : undefined,
      orderBy: { balance: 'asc' },
      take,
      select: {
        id: true,
        userId: true,
        balance: true,
        lifetimePurchased: true,
        lifetimeSpent: true,
        updatedAt: true,
        user: { select: { email: true, name: true } },
      },
    })

    return NextResponse.json({
      data: wallets.map(w => ({
        walletId: w.id,
        userId: w.userId,
        email: w.user.email,
        name: w.user.name,
        balance: w.balance,
        lifetimePurchased: w.lifetimePurchased,
        lifetimeSpent: w.lifetimeSpent,
        updatedAt: w.updatedAt.toISOString(),
      })),
    })
  } catch (err) {
    logApiError('admin/credits/wallets', 'GET', err)
    return apiError('Failed to load wallets', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
