// =============================================================================
// Payment Service
// Handles the full purchase lifecycle for premium products.
// =============================================================================

import { prisma } from '@/config/prisma'
import { StripeAdapter } from './providers/stripe/stripe.adapter'
import type {
  PaymentProviderInterface,
  CreateCheckoutPayload,
  CheckoutSession,
  PremiumPurchase,
  PaymentStatus,
  AccessGrant,
} from '@/types'

// Product pricing catalogue
const PRODUCT_PRICES: Record<string, { amountCents: number; currency: string; label: string }> = {
  CARVERTICAL_REPORT: {
    amountCents: 1499,
    currency: 'EUR',
    label: 'CarVertical Full Vehicle History Report',
  },
  AI_DEEP_SCAN: {
    amountCents: 999,
    currency: 'EUR',
    label: 'AI Deep Photo Analysis — Full Scan',
  },
  FULL_INSPECTION_BUNDLE: {
    amountCents: 2499,
    currency: 'EUR',
    label: 'Full Inspection Bundle (History + AI)',
  },
}

export class PaymentService {
  private provider: PaymentProviderInterface

  constructor(provider?: PaymentProviderInterface) {
    // Default to Stripe. Override in tests or for future providers.
    this.provider = provider ?? new StripeAdapter()
  }

  /**
   * createCheckout
   * Creates a purchase record and returns a Stripe checkout URL.
   * The purchase starts in PENDING state.
   */
  async createCheckout(
    userId: string,
    payload: CreateCheckoutPayload,
    baseUrl: string
  ): Promise<CheckoutSession> {
    const product = PRODUCT_PRICES[payload.productType]
    if (!product) throw new Error(`Unknown product type: ${payload.productType}`)

    // Idempotency: if already paid, return early
    const existing = await prisma.premiumPurchase.findFirst({
      where: { userId, vehicleId: payload.vehicleId, productType: payload.productType as any },
    })
    if (existing?.status === 'PAID') {
      throw new Error('ALREADY_PURCHASED: This report has already been purchased.')
    }

    // Create or reuse a pending purchase record
    const purchase = await prisma.premiumPurchase.upsert({
      where: {
        // Compound unique: userId + vehicleId + productType
        userId_vehicleId_productType: {
          userId,
          vehicleId: payload.vehicleId,
          productType: payload.productType as any,
        },
      },
      update: {
        status: 'PENDING',
        amountCents: product.amountCents,
        currency: product.currency,
      },
      create: {
        userId,
        vehicleId: payload.vehicleId,
        productType: payload.productType as any,
        status: 'PENDING',
        amountCents: product.amountCents,
        currency: product.currency,
      },
    })

    // Create external checkout session
    const session = await this.provider.createCheckoutSession({
      purchaseId: purchase.id,
      amountCents: product.amountCents,
      currency: product.currency,
      description: product.label,
      successUrl: `${baseUrl}/premium?status=success&purchaseId=${purchase.id}`,
      cancelUrl: `${baseUrl}/premium?status=cancelled`,
      metadata: { purchaseId: purchase.id, userId, vehicleId: payload.vehicleId },
    })

    // Store the provider transaction ID
    await prisma.premiumPurchase.update({
      where: { id: purchase.id },
      data: { providerTxId: session.externalId },
    })

    return {
      purchaseId: purchase.id,
      checkoutUrl: session.checkoutUrl,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30min
    }
  }

  /**
   * handleWebhook
   * Called from the Stripe webhook route handler.
   * Confirms payment and grants access.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    const event = await this.provider.constructWebhookEvent(rawBody, signature)

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onPaymentSucceeded(event.data as any)
        break
      case 'checkout.session.expired':
        await this.onPaymentExpired(event.data as any)
        break
      case 'charge.refunded':
        await this.onRefunded(event.data as any)
        break
    }
  }

  /**
   * verifyAccess
   * Returns true if the user has active paid access to a product for a vehicle.
   */
  async verifyAccess(
    userId: string,
    vehicleId: string,
    productType: string
  ): Promise<boolean> {
    const grant = await prisma.accessGrant.findFirst({
      where: {
        userId,
        vehicleId,
        productType: productType as any,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })
    return !!grant
  }

  /**
   * getPurchaseStatus
   */
  async getPurchaseStatus(
    userId: string,
    vehicleId: string,
    productType: string
  ): Promise<PaymentStatus> {
    const purchase = await prisma.premiumPurchase.findFirst({
      where: { userId, vehicleId, productType: productType as any },
    })
    return (purchase?.status as PaymentStatus) ?? 'NOT_PURCHASED'
  }

  // ─── Private event handlers ─────────────────────────────────────────────────

  private async onPaymentSucceeded(data: { metadata?: { purchaseId: string } }) {
    const purchaseId = data?.metadata?.purchaseId
    if (!purchaseId) return

    const purchase = await prisma.premiumPurchase.update({
      where: { id: purchaseId },
      data: { status: 'PAID', purchasedAt: new Date() },
    })

    // Grant access
    await prisma.accessGrant.upsert({
      where: { purchaseId },
      update: { isActive: true, grantedAt: new Date() },
      create: {
        userId: purchase.userId,
        purchaseId: purchase.id,
        productType: purchase.productType,
        vehicleId: purchase.vehicleId,
        grantedAt: new Date(),
      },
    })

    // Log billing event
    await prisma.paymentEvent.create({
      data: {
        purchaseId,
        userId: purchase.userId,
        eventType: 'payment.succeeded',
        provider: this.provider.providerId,
        payload: data as any,
      },
    })
  }

  private async onPaymentExpired(data: { metadata?: { purchaseId: string } }) {
    const purchaseId = data?.metadata?.purchaseId
    if (!purchaseId) return
    await prisma.premiumPurchase.update({
      where: { id: purchaseId },
      data: { status: 'EXPIRED' },
    })
  }

  private async onRefunded(data: { metadata?: { purchaseId: string } }) {
    const purchaseId = data?.metadata?.purchaseId
    if (!purchaseId) return
    const purchase = await prisma.premiumPurchase.update({
      where: { id: purchaseId },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    })
    await prisma.accessGrant.updateMany({
      where: { purchaseId },
      data: { isActive: false, revokedAt: new Date() },
    })
    await prisma.paymentEvent.create({
      data: {
        purchaseId,
        userId: purchase.userId,
        eventType: 'payment.refunded',
        provider: this.provider.providerId,
        payload: data as any,
      },
    })
  }
}

export const paymentService = new PaymentService()
