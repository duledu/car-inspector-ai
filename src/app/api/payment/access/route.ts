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
    const hasAccess = await paymentService.verifyAccess(
      auth.userId,
      parsed.data.vehicleId,
      parsed.data.productType
    )

    return NextResponse.json({ data: { hasAccess } })
  } catch (err) {
    logApiError('payment/access', 'verifyAccess', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Failed to verify payment access', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
