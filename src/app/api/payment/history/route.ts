import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return NextResponse.json({ message: auth.reason, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const history = await paymentService.getPurchaseHistory(auth.userId)
  return NextResponse.json({ data: history })
}
