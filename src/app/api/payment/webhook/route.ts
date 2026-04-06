// =============================================================================
// Stripe Webhook Handler — POST /api/payment/webhook
// IMPORTANT: This route must read the RAW body (not parsed JSON).
// Next.js requires bodyParser to be disabled for Stripe webhook verification.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/modules/payments/payment.service'

// In the App Router, request bodies are not auto-parsed, so no config needed.
// req.text() reads the raw bytes Stripe needs for signature verification.
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { message: 'Missing Stripe signature header', code: 'MISSING_SIGNATURE' },
      { status: 400 }
    )
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ message: 'Failed to read request body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  try {
    await paymentService.handleWebhook(rawBody, signature)
    return NextResponse.json({ received: true })
  } catch (err: any) {
    console.error('[webhook/stripe] Processing error:', err.message)
    // Return 400 to tell Stripe to retry
    return NextResponse.json(
      { message: err.message, code: 'WEBHOOK_PROCESSING_ERROR' },
      { status: 400 }
    )
  }
}
