// POST /api/credits/grant-test
// Development / admin QA endpoint.
//
// SECURITY: Double-gated —
//   1. Only available when NODE_ENV !== 'production'
//   2. Caller must have ADMIN role
//
// Body: { userId?: string, amount?: number }
//   userId  — target user (defaults to authenticated caller)
//   amount  — credits to grant (defaults to 1, max 10)

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError, parseJsonBody } from '@/utils/api-response'
import { grantCredits } from '@/lib/credits/credit-wallet'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  // Gate 1: non-production only
  if (process.env.NODE_ENV === 'production') {
    return apiError('Not found', { status: 404 })
  }

  // Gate 2: authenticated + admin role
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }
  if (auth.role !== 'ADMIN') {
    return apiError('Admin role required', { status: 403, code: 'FORBIDDEN' })
  }

  const body = await parseJsonBody(req)
  if (!body.ok) return body.response

  const raw = body.data as Record<string, unknown>
  const targetUserId: string = typeof raw.userId === 'string' ? raw.userId : auth.userId
  const rawAmount = typeof raw.amount === 'number' ? raw.amount : 1
  const amount = Math.min(Math.max(1, Math.floor(rawAmount)), 10)

  try {
    const wallet = await grantCredits({
      userId: targetUserId,
      amount,
      provider: 'ADMIN',
      type: 'ADMIN_GRANT',
      idempotencyKey: `admin-grant-${randomUUID()}`,
      metadata: {
        grantedBy: auth.userId,
        reason: 'QA test grant',
        environment: process.env.NODE_ENV,
      },
    })

    return NextResponse.json({
      data: {
        userId: targetUserId,
        granted: amount,
        balance: wallet.balance,
        lifetimePurchased: wallet.lifetimePurchased,
      },
    })
  } catch (err) {
    logApiError('credits/grant-test', 'grantCredits', err, { userId: targetUserId })
    return apiError('Failed to grant credits', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
