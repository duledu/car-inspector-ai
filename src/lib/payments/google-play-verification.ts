// =============================================================================
// Google Play Purchase Verification (Phase 2 — implemented)
//
// Server-to-server verification against the Google Play Developer API.
// Never trust client-supplied purchase state — every decision here is based
// on what Google's API itself returns for the given (productId, token) pair.
//
// purchaseState: 0 = Purchased, 1 = Cancelled, 2 = Pending
// consumptionState: 0 = Not consumed, 1 = Consumed
// acknowledgementState: 0 = Not acknowledged, 1 = Acknowledged
// =============================================================================

import { getAndroidPublisherClient, getPackageName } from './google-play-auth'

export class GooglePlayVerificationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'GooglePlayVerificationError'
  }
}

export interface GooglePlayPurchaseVerification {
  purchaseToken: string
  productId: string
  packageName: string
}

export interface GooglePlayVerifiedPurchase {
  purchaseToken: string
  productId: string
  orderId: string
  purchaseState: number
  consumptionState: number
  acknowledgementState: number
  purchaseTimeMillis: string
}

function assertExpectedPackage(packageName: string): string {
  const expected = getPackageName()
  if (packageName !== expected) {
    throw new GooglePlayVerificationError(
      `Package name mismatch: expected "${expected}", received "${packageName}"`,
      'PACKAGE_MISMATCH',
    )
  }
  return expected
}

/**
 * Verifies a Google Play purchase token against the Developer API.
 * Throws GooglePlayVerificationError on any failure — callers must not
 * grant credits unless this resolves successfully.
 */
export async function verifyGooglePlayPurchase(
  payload: GooglePlayPurchaseVerification,
): Promise<GooglePlayVerifiedPurchase> {
  const packageName = assertExpectedPackage(payload.packageName)
  const client = getAndroidPublisherClient()

  let response
  try {
    response = await client.purchases.products.get({
      packageName,
      productId: payload.productId,
      token: payload.purchaseToken,
    })
  } catch (err) {
    const status = (err as { code?: number; status?: number })?.code ?? (err as { status?: number })?.status
    if (status === 404 || status === 400) {
      throw new GooglePlayVerificationError('Purchase token is invalid or unknown to Google Play', 'INVALID_TOKEN')
    }
    throw new GooglePlayVerificationError('Failed to reach the Google Play Developer API', 'VERIFICATION_FAILED')
  }

  const data = response.data
  if (data.purchaseState === undefined || data.purchaseState === null) {
    throw new GooglePlayVerificationError('Google Play returned no purchase state', 'INVALID_RESPONSE')
  }

  return {
    purchaseToken: payload.purchaseToken,
    productId: payload.productId,
    orderId: data.orderId ?? '',
    purchaseState: data.purchaseState,
    consumptionState: data.consumptionState ?? 0,
    acknowledgementState: data.acknowledgementState ?? 0,
    purchaseTimeMillis: data.purchaseTimeMillis ?? '',
  }
}

/**
 * Acknowledges a verified purchase so Google does not auto-refund it.
 * Must be called within 3 days of purchase, and only after credits have
 * been granted.
 */
export async function acknowledgeGooglePlayPurchase(
  purchaseToken: string,
  productId: string,
  packageName: string,
): Promise<void> {
  const pkg = assertExpectedPackage(packageName)
  const client = getAndroidPublisherClient()

  try {
    await client.purchases.products.acknowledge({
      packageName: pkg,
      productId,
      token: purchaseToken,
      requestBody: {},
    })
  } catch (err) {
    throw new GooglePlayVerificationError('Failed to acknowledge purchase with Google Play', 'ACKNOWLEDGE_FAILED')
  }
}

/**
 * Consumes a verified purchase so the same product can be purchased again
 * (all credit-pack products are repeatable/consumable).
 */
export async function consumeGooglePlayPurchase(
  purchaseToken: string,
  productId: string,
  packageName: string,
): Promise<void> {
  const pkg = assertExpectedPackage(packageName)
  const client = getAndroidPublisherClient()

  try {
    await client.purchases.products.consume({
      packageName: pkg,
      productId,
      token: purchaseToken,
    })
  } catch (err) {
    throw new GooglePlayVerificationError('Failed to consume purchase with Google Play', 'CONSUME_FAILED')
  }
}

export interface GooglePlayVoidedPurchase {
  purchaseToken: string
  orderId: string
  voidedTimeMillis: string
  voidedReason: number | null
  voidedSource: number | null
}

// Google's purchases.voidedpurchases.list is token-paginated (tokenPagination.
// nextPageToken) with no documented bound on page count. This loop must fail
// closed rather than spin forever if Google ever returns a malformed or
// cyclical token, so a page beyond this count is treated as an authoritative
// failure instead of "no more results" — 1000 results/page x 20 pages covers
// 20,000 voided purchases in the 30-day window, far beyond any real volume.
const MAX_VOIDED_PURCHASES_PAGES = 20

/**
 * Pages through Google's voided-purchases record within a recent time window,
 * yielding one page at a time so callers can stop as soon as they find what
 * they're looking for instead of accumulating the whole window in memory.
 * Any page request failure (including exceeding the defensive page cap)
 * throws — callers must treat that as "unable to confirm", never as "not
 * voided".
 */
async function* iterateVoidedPurchasePages(withinMs: number): AsyncGenerator<GooglePlayVoidedPurchase[]> {
  const client = getAndroidPublisherClient()
  const packageName = getPackageName()
  const endTime = Date.now()
  const startTime = Math.max(0, endTime - withinMs)

  let pageToken: string | undefined
  for (let page = 1; ; page++) {
    if (page > MAX_VOIDED_PURCHASES_PAGES) {
      throw new GooglePlayVerificationError(
        `Exceeded maximum voided-purchases page count (${MAX_VOIDED_PURCHASES_PAGES}) without reaching the end of results`,
        'VOIDED_LIST_PAGINATION_LIMIT',
      )
    }

    let response
    try {
      response = await client.purchases.voidedpurchases.list({
        packageName,
        startTime: String(startTime),
        endTime: String(endTime),
        maxResults: 1000,
        type: 0, // in-app product purchases only — this app has no subscriptions
        ...(pageToken ? { token: pageToken } : {}),
      })
    } catch (err) {
      throw new GooglePlayVerificationError('Failed to list voided purchases from Google Play', 'VOIDED_LIST_FAILED')
    }

    yield (response.data.voidedPurchases ?? []).map(v => ({
      purchaseToken: v.purchaseToken ?? '',
      orderId: v.orderId ?? '',
      voidedTimeMillis: v.voidedTimeMillis ?? '',
      voidedReason: v.voidedReason ?? null,
      voidedSource: v.voidedSource ?? null,
    }))

    const nextPageToken = response.data.tokenPagination?.nextPageToken
    if (!nextPageToken) return
    pageToken = nextPageToken
  }
}

/**
 * Lists purchases Google itself has recorded as voided (cancelled, refunded,
 * or charged back) within a recent time window, following pagination to
 * completion. This is the purpose-built API for confirming a void — unlike
 * purchases.products.get (which confirms a purchase is currently valid),
 * this is what actually reflects refund state.
 */
export async function listVoidedPurchases(withinMs = 30 * 24 * 60 * 60 * 1000): Promise<GooglePlayVoidedPurchase[]> {
  const all: GooglePlayVoidedPurchase[] = []
  for await (const page of iterateVoidedPurchasePages(withinMs)) {
    all.push(...page)
  }
  return all
}

/**
 * Confirms that a specific purchaseToken genuinely appears in Google's own
 * voided-purchases record within the last 30 days (Google's own lookback
 * limit for this API), before an RTDN notification claiming it was voided
 * is trusted enough to debit a wallet. Walks pages in order and stops as
 * soon as a match is found rather than accumulating every voided purchase
 * in memory; any page failure (including the defensive page-count limit)
 * propagates so the caller fails closed instead of treating it as "not
 * voided".
 */
export async function wasPurchaseVoided(purchaseToken: string): Promise<boolean> {
  for await (const page of iterateVoidedPurchasePages(30 * 24 * 60 * 60 * 1000)) {
    if (page.some(v => v.purchaseToken === purchaseToken)) return true
  }
  return false
}
