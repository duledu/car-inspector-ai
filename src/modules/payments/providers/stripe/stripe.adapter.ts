// =============================================================================
// Payment Provider Interface
// Any payment provider (Stripe, PayPal, Adyen) must implement this.
// =============================================================================

import type { PaymentProviderInterface, PaymentStatus, WebhookEvent } from '@/types'

// ─── Stripe Adapter ──────────────────────────────────────────────────────────

import Stripe from 'stripe'

export class StripeAdapter implements PaymentProviderInterface {
  readonly providerId = 'stripe'
  private stripe: Stripe

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      if (process.env.NEXT_PHASE === 'phase-production-build') {
        // Build-time placeholder — no Stripe calls are made during the build.
        this.stripe = null as unknown as Stripe
        return
      }
      throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
    }
    this.stripe = new Stripe(key, { apiVersion: '2024-04-10' })
  }

  async createCheckoutSession(payload: {
    purchaseId: string
    amountCents: number
    currency: string
    description: string
    successUrl: string
    cancelUrl: string
    metadata?: Record<string, string>
  }): Promise<{ externalId: string; checkoutUrl: string; clientSecret?: string }> {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: payload.currency.toLowerCase(),
            product_data: { name: payload.description },
            unit_amount: payload.amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
      metadata: {
        purchaseId: payload.purchaseId,
        ...payload.metadata,
      },
    })

    return {
      externalId: session.id,
      checkoutUrl: session.url ?? '',
    }
  }

  async retrievePaymentStatus(externalId: string): Promise<PaymentStatus> {
    const session = await this.stripe.checkout.sessions.retrieve(externalId)
    const map: Record<string, PaymentStatus> = {
      complete: 'PAID',
      expired: 'EXPIRED',
      open: 'PENDING',
    }
    return map[session.status ?? ''] ?? 'FAILED'
  }

  async refund(externalId: string, amountCents?: number): Promise<boolean> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(externalId, {
        expand: ['payment_intent'],
      })
      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id

      if (!paymentIntentId) return false

      await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amountCents,
      })
      return true
    } catch {
      return false
    }
  }

  async constructWebhookEvent(payload: string, signature: string): Promise<WebhookEvent> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not set.')

    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    return {
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    }
  }
}
