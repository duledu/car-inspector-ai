import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'

const querySchema = z.object({
  vehicleId: z.string().min(1),
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE']),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return NextResponse.json({ message: auth.reason, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const parsed = querySchema.safeParse({
    vehicleId: req.nextUrl.searchParams.get('vehicleId'),
    productType: req.nextUrl.searchParams.get('productType'),
  })
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', code: 'VALIDATION_ERROR' }, { status: 422 })
  }

  const hasAccess = await paymentService.verifyAccess(
    auth.userId,
    parsed.data.vehicleId,
    parsed.data.productType
  )

  return NextResponse.json({ data: { hasAccess } })
}
