// =============================================================================
// Stripe Webhook Handler — POST /api/payment/webhook
// IMPORTANT: This route must read the RAW body (not parsed JSON).
// Next.js requires bodyParser to be disabled for Stripe webhook verification.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { paymentService } from '@/modules/payments/payment.service'
import { apiError, logApiError } from '@/utils/api-response'

// In the App Router, request bodies are not auto-parsed, so no config needed.
// req.text() reads the raw bytes Stripe needs for signature verification.
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return apiError('Missing Stripe signature header', { status: 400, code: 'MISSING_SIGNATURE' })
  }

  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return apiError('Failed to read request body', { status: 400, code: 'BAD_REQUEST' })
  }

  try {
    await paymentService.handleWebhook(rawBody, signature)
    return NextResponse.json({ received: true })
  } catch (err: any) {
    logApiError('payment/webhook', 'handleWebhook', err)
    // Return 400 to tell Stripe to retry
    return apiError(err.message, { status: 400, code: 'WEBHOOK_PROCESSING_ERROR' })
  }
}
