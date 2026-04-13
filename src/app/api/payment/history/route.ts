import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  try {
    const history = await paymentService.getPurchaseHistory(auth.userId)
    return NextResponse.json({ data: history })
  } catch (err) {
    logApiError('payment/history', 'getPurchaseHistory', err)
    return apiError('Failed to fetch purchase history', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
