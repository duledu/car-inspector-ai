// =============================================================================
// Payment Service — Integration Tests
// Tests the service layer with a mock payment provider and real Prisma calls.
// Uses a test database (set TEST_DATABASE_URL in .env.test).
// =============================================================================

import { PaymentService } from '../../src/modules/payments/payment.service'
import type { PaymentProviderInterface, PaymentStatus, WebhookEvent } from '../../src/types'

// ─── Mock Provider ────────────────────────────────────────────────────────────

class MockPaymentProvider implements PaymentProviderInterface {
  readonly providerId = 'mock'

  async createCheckoutSession(payload: any) {
    return {
      externalId: `mock_session_${Date.now()}`,
      checkoutUrl: 'https://checkout.mock.com/test',
    }
  }

  async retrievePaymentStatus(externalId: string): Promise<PaymentStatus> {
    return 'PAID'
  }

  async refund(externalId: string): Promise<boolean> {
    return true
  }

  async constructWebhookEvent(payload: string, signature: string): Promise<WebhookEvent> {
    const data = JSON.parse(payload)
    return { type: data.type, data: data.data }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PaymentService', () => {
  let service: PaymentService

  beforeEach(() => {
    service = new PaymentService(new MockPaymentProvider())
  })

  test('createCheckout returns a valid checkout session', async () => {
    // This test requires a test database — skipped if not configured
    if (!process.env.TEST_DATABASE_URL) {
      console.log('Skipping: TEST_DATABASE_URL not set')
      return
    }

    const checkout = await service.createCheckout(
      'user-test-id',
      { vehicleId: 'vehicle-test-id', productType: 'CARVERTICAL_REPORT' },
      'http://localhost:3000'
    )

    expect(checkout.purchaseId).toBeDefined()
    expect(checkout.checkoutUrl).toContain('checkout.mock.com')
    expect(checkout.expiresAt).toBeDefined()
  })

  test('verifyAccess returns false for unpurchased product', async () => {
    if (!process.env.TEST_DATABASE_URL) return

    const hasAccess = await service.verifyAccess('user-1', 'vehicle-1', 'CARVERTICAL_REPORT')
    expect(hasAccess).toBe(false)
  })

  test('handleWebhook processes payment.succeeded correctly', async () => {
    if (!process.env.TEST_DATABASE_URL) return

    const fakeEvent = JSON.stringify({
      type: 'checkout.session.completed',
      data: { metadata: { purchaseId: 'non-existent-purchase' } },
    })

    // Should not throw — graceful handling of missing purchaseId
    await expect(
      service.handleWebhook(fakeEvent, 'mock-signature')
    ).resolves.not.toThrow()
  })
})
