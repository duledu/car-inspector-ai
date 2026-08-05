// =============================================================================
// Google Play Billing client — Digital Goods API + Payment Request API
//
// Browser-only. This is the officially recommended way to receive Play
// Billing payments inside a Trusted Web Activity (no native Android code —
// Chrome bridges these web APIs to Play Billing once the TWA is verified;
// see GOOGLE_PLAY_BILLING_SETUP.md). Every function here only ever returns a
// purchaseToken to the caller — nothing in this file grants credits. Credits
// are granted exclusively by the server after it independently re-verifies
// the token against the Google Play Developer API.
// =============================================================================

const PLAY_BILLING_METHOD = 'https://play.google.com/billing'

export interface PlayProductDetails {
  itemId: string
  title: string
  description?: string
  price: { currency: string; value: string }
}

export interface PlayPurchaseResult {
  productId: string
  purchaseToken: string
}

interface DigitalGoodsService {
  getDetails(itemIds: string[]): Promise<PlayProductDetails[]>
  listPurchases(): Promise<Array<{ itemId: string; purchaseToken: string }>>
  consume(purchaseToken: string): Promise<void>
}

declare global {
  interface Window {
    getDigitalGoodsService?: (paymentMethod: string) => Promise<DigitalGoodsService>
  }
}

export function isPlayBillingAvailable(): boolean {
  return typeof window !== 'undefined'
    && typeof window.getDigitalGoodsService === 'function'
    && typeof (window as any).PaymentRequest === 'function'
}

let cachedService: DigitalGoodsService | null = null

async function getService(): Promise<DigitalGoodsService> {
  if (cachedService) return cachedService
  if (typeof window === 'undefined' || !window.getDigitalGoodsService) {
    throw new Error('Google Play Billing is not available in this browser context')
  }
  cachedService = await window.getDigitalGoodsService(PLAY_BILLING_METHOD)
  return cachedService
}

/** Fetches title/description/price for a set of Play Console product SKUs. */
export async function getProductDetails(itemIds: string[]): Promise<PlayProductDetails[]> {
  const service = await getService()
  return service.getDetails(itemIds)
}

/**
 * Launches the native Google Play purchase UI for a single SKU via the
 * Payment Request API. Resolves with the purchase token once the purchase
 * completes — the caller must send this to the server for verification
 * before treating it as real; it is never trusted on its own.
 */
export async function purchaseProduct(itemId: string): Promise<PlayPurchaseResult> {
  if (typeof (window as any).PaymentRequest === 'undefined') {
    throw new Error('PaymentRequest API is not available')
  }

  const methodData = [{ supportedMethods: PLAY_BILLING_METHOD, data: { sku: itemId } }]
  // Play Billing ignores this — the real price comes from the Play Console
  // product configuration — but PaymentRequest requires a details object.
  const details = { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } }

  const PaymentRequestCtor = (window as any).PaymentRequest
  const request = new PaymentRequestCtor(methodData, details)
  const paymentResponse = await request.show()

  const responseDetails = paymentResponse.details as { purchaseToken?: string; token?: string }
  const purchaseToken = responseDetails?.purchaseToken ?? responseDetails?.token

  if (!purchaseToken) {
    await paymentResponse.complete('fail')
    throw new Error('Google Play did not return a purchase token')
  }

  await paymentResponse.complete('success')
  return { productId: itemId, purchaseToken }
}

/**
 * Lists purchases Play still considers unresolved for this app/user (not yet
 * consumed). Used on app foreground/resume to recover from a purchase that
 * succeeded on Google's side but never reached the server (app closed mid-
 * checkout, network drop, etc.) — each returned token should be resubmitted
 * to POST /api/credits/google-play/verify, which is idempotent per token.
 */
export async function listUnresolvedPurchases(): Promise<PlayPurchaseResult[]> {
  if (!isPlayBillingAvailable()) return []
  try {
    const service = await getService()
    const purchases = await service.listPurchases()
    return purchases.map(p => ({ productId: p.itemId, purchaseToken: p.purchaseToken }))
  } catch {
    return []
  }
}

/** Marks a purchase consumed client-side once the server confirms the grant. */
export async function consumePurchase(purchaseToken: string): Promise<void> {
  const service = await getService()
  await service.consume(purchaseToken)
}
