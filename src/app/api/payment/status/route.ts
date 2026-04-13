import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const querySchema = z.object({
  vehicleId: z.string().min(1),
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE']),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  const parsed = querySchema.safeParse({
    vehicleId: req.nextUrl.searchParams.get('vehicleId'),
    productType: req.nextUrl.searchParams.get('productType'),
  })
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const status = await paymentService.getPurchaseStatus(
      auth.userId,
      parsed.data.vehicleId,
      parsed.data.productType
    )

    return NextResponse.json({ data: { status } })
  } catch (err) {
    logApiError('payment/status', 'getPurchaseStatus', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Failed to fetch payment status', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
