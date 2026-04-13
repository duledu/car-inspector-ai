// =============================================================================
// Payment API Route — POST /api/payment/checkout
// Creates a Stripe checkout session and returns the URL.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const createCheckoutSchema = z.object({
  vehicleId: z.string().min(1),
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE']),
})

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON body', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = createCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  try {
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`
    const checkout = await paymentService.createCheckout(
      authResult.userId,
      parsed.data,
      baseUrl
    )
    return NextResponse.json({ data: checkout }, { status: 201 })
  } catch (err: any) {
    if (err.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    if (err.message?.startsWith('ALREADY_PURCHASED')) {
      return apiError(err.message, { status: 409, code: 'ALREADY_PURCHASED' })
    }
    logApiError('payment', 'createCheckout', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Failed to create checkout session', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
