// =============================================================================
// Google Play Purchase Verification — PLACEHOLDER (Phase 1)
//
// Phase 2 will implement real Google Play Developer API verification.
// Until then every function throws NOT_IMPLEMENTED so no code path can
// accidentally treat unverified purchases as genuine.
//
// Phase 2 implementation guide (DO NOT implement here):
//
//   1. Server-to-server verification
//      Call the Google Play Developer API:
//        GET https://androidpublisher.googleapis.com/androidpublisher/v3/applications
//            /{packageName}/purchases/products/{productId}/tokens/{purchaseToken}
//      This returns a ProductPurchase object with:
//        - purchaseState: 0 = Purchased, 1 = Cancelled, 2 = Pending
//        - consumptionState: 0 = Not consumed, 1 = Consumed
//        - acknowledgementState: 0 = Not acknowledged, 1 = Acknowledged
//        - orderId: the Google order ID (important for deduplication)
//
//   2. Anti-double-grant logic (CRITICAL)
//      Before granting any credits:
//        a. Check GooglePlayPurchase.purchaseToken is not already in the DB
//           with status GRANTED/CONSUMED.
//        b. Use a DB transaction + idempotencyKey derived from purchaseToken
//           to ensure atomicity.
//        c. If purchaseToken already exists → return the existing grant record
//           without touching the wallet balance.
//
//   3. Acknowledgement
//      After granting credits, acknowledge the purchase:
//        POST https://androidpublisher.googleapis.com/androidpublisher/v3/
//             applications/{packageName}/purchases/products/{productId}/
//             tokens/{purchaseToken}:acknowledge
//      Google will refund unacknowledged purchases after ~3 days.
//
//   4. Consumption (for consumable products)
//      After acknowledging, consume the purchase so it can be re-bought:
//        POST .../tokens/{purchaseToken}:consume
//
//   5. Credentials
//      Use a Google service account (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env var)
//      with the "Financial data viewer" or "Order management" role.
//      The googleapis npm package handles OAuth2 token refresh.
//
//   6. Signature verification (optional but recommended)
//      The Android client can pass the signed purchase data. Verify the
//      RSA-SHA1 signature using the app's Base64-encoded public key from
//      the Play Console (Settings → API access → License key).
//
// =============================================================================

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
  purchaseState: number       // 0=Purchased, 1=Cancelled, 2=Pending
  consumptionState: number    // 0=Not consumed, 1=Consumed
  acknowledgementState: number // 0=Not acknowledged, 1=Acknowledged
  purchaseTimeMillis: string
}

/**
 * Verifies a Google Play purchase token against the Developer API.
 *
 * Phase 2 TODO: Implement using googleapis package with service-account auth.
 * The token must be verified server-side — never trust client-supplied data.
 */
export async function verifyGooglePlayPurchase(
  _payload: GooglePlayPurchaseVerification,
): Promise<GooglePlayVerifiedPurchase> {
  throw new GooglePlayVerificationError(
    'Google Play verification is not yet implemented (Phase 2)',
    'NOT_IMPLEMENTED',
  )
}

/**
 * Acknowledges a verified purchase so Google does not auto-refund it.
 *
 * Phase 2 TODO: Call the acknowledge endpoint after credits are granted.
 * Must be called within 3 days of purchase.
 */
export async function acknowledgeGooglePlayPurchase(
  _purchaseToken: string,
  _productId: string,
  _packageName: string,
): Promise<void> {
  throw new GooglePlayVerificationError(
    'Google Play acknowledgement is not yet implemented (Phase 2)',
    'NOT_IMPLEMENTED',
  )
}

/**
 * Consumes a verified purchase so the product can be re-purchased.
 *
 * Phase 2 TODO: Call after acknowledgement for consumable products.
 */
export async function consumeGooglePlayPurchase(
  _purchaseToken: string,
  _productId: string,
  _packageName: string,
): Promise<void> {
  throw new GooglePlayVerificationError(
    'Google Play consumption is not yet implemented (Phase 2)',
    'NOT_IMPLEMENTED',
  )
}
