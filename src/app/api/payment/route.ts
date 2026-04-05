// =============================================================================
// Payment API Route — POST /api/payment/checkout
// Creates a Stripe checkout session and returns the URL.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { paymentService } from '@/modules/payments/payment.service'
import { requireAuth } from '@/utils/auth.middleware'

const createCheckoutSchema = z.object({
  vehicleId: z.string().min(1),
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE']),
})

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return NextResponse.json({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const parsed = createCheckoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
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
    if (err.message?.startsWith('ALREADY_PURCHASED')) {
      return NextResponse.json({ message: err.message, code: 'ALREADY_PURCHASED' }, { status: 409 })
    }
    console.error('[payment/checkout] Error:', err)
    return NextResponse.json({ message: 'Failed to create checkout session', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
