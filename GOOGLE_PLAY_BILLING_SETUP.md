# Google Play Billing Setup — Used Cars Doctor

How to configure Google Play Console, the service account, and this app's environment so the Android TWA can sell credit packs through Google Play Billing. Written for whoever runs the Play Console side of this — no code changes are described here, only external configuration.

## 1. Architecture recap

- **Android app**: buys generic **credit packs** (`inspection_credit_1`…`inspection_credit_5`) through Google Play Billing, using the Digital Goods API + Payment Request API inside the TWA. No native Android billing code — Chrome bridges these web APIs to Play Billing automatically once the app is a verified TWA.
- **Server**: the sole authority on what's granted. `POST /api/credits/google-play/verify` re-verifies every purchase token against the Google Play Developer API before crediting the wallet — the client's word is never trusted alone.
- **Credits are spent**, not tied to a specific product at purchase time. `POST /api/credits/redeem` spends credits to unlock a specific report for a specific vehicle. Only `INSPECTION_REPORT` (1 credit), `AI_DEEP_SCAN` (2 credits), and `FULL_INSPECTION_BUNDLE` (5 credits) are unlockable this way — see `src/lib/credits/product-credit-costs.ts`. `CARVERTICAL_REPORT` is intentionally not sold in the Android app at all (third-party resold data, not a native AI feature); it remains web/Stripe only.
- **Web** keeps using Stripe, completely unchanged, for all four products including CarVertical.

## 2. Products to create in Play Console

Play Console → your app → Monetize → Products → In-app products. Create exactly these **five one-time (managed) products**:

| Product ID | Credits granted | Suggested price tier |
|---|---|---|
| `inspection_credit_1` | 1 | ≈ EUR 4.99 |
| `inspection_credit_2` | 2 | ≈ EUR 8.99 |
| `inspection_credit_3` | 3 | ≈ EUR 12.99 |
| `inspection_credit_4` | 4 | ≈ EUR 16.99 |
| `inspection_credit_5` | 5 | ≈ EUR 19.99 (bulk discount vs. buying singly) |

These IDs must match `GOOGLE_PLAY_PRODUCTS` in `src/lib/payments/google-play-products.ts` exactly (they already do — this table documents what to create in Play Console, not what to change in code). Do **not** create a product for CarVertical, AI Deep Scan, or the inspection bundle directly — those are unlocked by spending credits, not bought as separate SKUs.

Mark all five as **managed products** (not subscriptions) — they're consumable; the server calls `consume()` after granting so a user can buy the same pack again.

## 3. Service account for server-side verification

1. Play Console → Setup → API access → link (or create) a Google Cloud project.
2. In that GCP project, create a service account (e.g. `play-billing-verifier@<project>.iam.gserviceaccount.com`).
3. Generate a JSON key for it and download it.
4. Back in Play Console → API access, grant that service account access to this app with:
   - **Financial data** → "View financial data, orders, and cancellation survey responses" (required for `purchases.products.get`)
   - **Order management** → ability to acknowledge/consume purchases (required for `purchases.products.acknowledge` / `.consume`)
5. It can take a few hours for Play Console permissions to propagate.

## 4. Environment variables

Set these in production (never commit real values — see `.env.example` for the placeholder names):

| Variable | Value |
|---|---|
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The full service-account JSON key from step 3, as a single-line string. Server-only — never logged, never sent to the client. |
| `GOOGLE_PLAY_PACKAGE_NAME` | `com.usedcarsdoctor.app` (defaults to this if unset). |
| `GOOGLE_PLAY_RTDN_TOKEN` | A long random string you choose. Appended as `?token=...` to the RTDN webhook URL (step 6) — checked in constant time, kept as a secondary filter alongside OIDC below. |
| `GOOGLE_PLAY_RTDN_OIDC_AUDIENCE` | The RTDN webhook URL itself (or another audience value you configure identically on the Pub/Sub push subscription). **Required** — the webhook rejects every request if this is unset. |
| `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` | The email of the service account the Pub/Sub push subscription authenticates as. **Required** — same fail-closed behavior. |

## 5. Digital Asset Links / assetlinks.json fingerprint

Already covered in the prior Play Store readiness audit (`GOOGLE_PLAY_READINESS_AUDIT.md`, §H) — the short version, since it's a prerequisite for the TWA (and therefore Play Billing) to work at all:

1. Upload your first signed AAB to Play Console (any track).
2. Play Console → Setup → App integrity → App signing → copy the **App signing key certificate** SHA-256 fingerprint (this is different from your local upload-key fingerprint already in `assetlinks.json`).
3. Add it as a second entry in `sha256_cert_fingerprints` in the production `assetlinks.json` served at `https://usedcarsdoctor.com/.well-known/assetlinks.json`.
4. Without this, the TWA won't verify for users who installed from Play (it'll show a browser address bar), and the Digital Goods API won't be available either, since it depends on the same TWA verification.

## 6. Real-time Developer Notifications (refunds/chargebacks)

The webhook requires **both** a valid OIDC bearer token from Pub/Sub and the shared-secret query token — it fails closed (rejects everything) if the OIDC env vars aren't set, so this section isn't optional.

1. Google Cloud Console → IAM → create a service account dedicated to this push subscription (e.g. `pubsub-push@<project>.iam.gserviceaccount.com`). This is the identity Pub/Sub will sign tokens as — it does not need any special Play Console permissions itself, only `roles/iam.serviceAccountTokenCreator` granted to the Pub/Sub service agent so Pub/Sub can mint tokens on its behalf (Google Cloud does this automatically when you configure OIDC on a push subscription via the console).
2. Google Cloud Console → Pub/Sub → create a topic, e.g. `play-billing-rtdn`.
3. Play Console → Monetize → Monetization setup → Real-time developer notifications → paste the topic name.
4. Create a **push subscription** on that topic pointing to:
   `https://usedcarsdoctor.com/api/credits/google-play/notifications?token=<GOOGLE_PLAY_RTDN_TOKEN>`
   — under the subscription's authentication settings, enable **"Enable authentication"**, select the service account from step 1, and set the audience to the same URL (this becomes `GOOGLE_PLAY_RTDN_OIDC_AUDIENCE`).
5. Set `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` to the service account's email from step 1, and `GOOGLE_PLAY_RTDN_OIDC_AUDIENCE` to the URL used in step 4.
6. This is what reverses a wallet grant when Google voids/refunds a purchase. The handler does not trust the notification body alone — it independently re-confirms the voided `purchaseToken` against Google's `purchases.voidedpurchases.list` API before calling `refundCredits()`. Without this whole setup, chargebacks won't be reflected in the user's balance at all (the endpoint will just reject every request).
7. **Debt model, not access revocation.** If a refund exceeds what's left in a user's wallet (some/all of it was already spent), the balance goes **negative** rather than clamping to zero — previously-generated AI reports are never automatically revoked. A negative balance blocks all further credit spending until a new purchase brings it back to zero or above. See `refundCredits`/`spendCredit` in `src/lib/credits/credit-wallet.ts`.
8. **Admin review**: `GET /api/admin/credits/wallets?negativeOnly=true` lists wallets currently in debt; `GET /api/admin/credits/wallets/:userId/ledger` shows one user's full transaction history. Both require an authenticated admin session (same `requireAdmin` gate as the rest of `/api/admin/*`).

## 7. Sandbox / license testers

1. Play Console → Setup → License testing → add the Google account(s) you'll test with.
2. License testers can complete purchases without being charged (test card, "Test card, always approves" etc.) as long as the app is on an internal/closed testing track they're opted into.
3. Install the app from that testing track (not a sideloaded APK) — Play Billing only works through the Digital Goods API when the app is installed via Play and passes asset-link verification.
4. To test refunds: Play Console → Order management → find the test order → Refund. This triggers an RTDN voided-purchase notification, which should hit step 6's webhook and reduce the tester's balance.

## 8. Manually testing each purchase state

| Scenario | How to trigger | Expected result |
|---|---|---|
| Success | Complete a purchase as a license tester | `POST /verify` returns `GRANTED`, wallet balance increases, purchase auto-consumed |
| Cancelled | Back out of the Play purchase sheet before confirming | No server call happens (Payment Request `show()` rejects) — no state change |
| Pending | Use a delayed payment method in a test region, or Play's test tooling for pending purchases | `POST /verify` returns `PENDING`, no credits granted yet |
| Duplicate token | Call `POST /verify` twice with the same token (e.g. retry after a flaky network response) | Second call returns `ALREADY_GRANTED`, no double credit |
| Invalid token | Send a malformed/garbage token | `POST /verify` returns 400 `INVALID_TOKEN` |
| Already consumed | Verify, then verify again after the purchase was consumed | Returns `ALREADY_GRANTED` (looked up by our own `GooglePlayPurchase.status`, not re-queried from Google) |
| Refund (unspent credits) | Refund via Play Console Order management before spending any of the purchased credits | RTDN webhook fires, wallet balance decreases by the refunded amount (never below 0 in this case), `GooglePlayPurchase.status` becomes `REVOKED` |
| Refund (already spent) | Spend all credits from a purchase (unlock a report), then refund that purchase | Wallet balance goes **negative** by the shortfall — the already-unlocked report stays accessible. Further `POST /redeem` calls return 402 `NEGATIVE_BALANCE_DEBT` until a new purchase repays the debt. |
| App closed mid-checkout | Force-close the app right after confirming a purchase, before `/verify` is called | On next app open, `listUnresolvedPurchases()` (Digital Goods API) should surface the token — resubmit it to `/verify`; this is implemented client-side in `src/lib/billing/google-play-client.ts` but the app must actually call it on resume (see §9 below). |

## 9. Regenerating the Android project (must be done on a machine with Java + Android SDK)

This repository's dev environment does not have a JDK installed, so the steps below could not be executed as part of implementing this feature — only `twa-manifest.json` was hand-edited. Run these yourself before building:

```bash
cd usedcarsdoctor-bubblewrap
npx @bubblewrap/cli update
# When prompted for versionName/versionCode, keep the existing values unless
# you're intentionally cutting a new release (1.0.0 / 1).
npx @bubblewrap/cli build
```

`twa-manifest.json` already has the required flags set:
```json
"features": { "playBilling": { "enabled": true } },
"alphaDependencies": { "enabled": true },
"enableNotifications": true
```

**Note on `enableNotifications`**: Bubblewrap's CLI refuses to enable Play Billing unless notification delegation is also enabled (`Play Billing requires enableNotifications to be true`) — they share the same underlying `TrustedWebActivityService`/`DelegationService`. This was discovered while implementing this feature, not a deliberate product decision to add push notifications; it's a hard technical prerequisite from Bubblewrap itself. The side effect: the app's `DelegationService` component becomes enabled/exported, meaning the app now supports web-push-to-native-notification delegation if the web app ever registers for it. It does not, by itself, send or show any notifications — nothing in this app's web push code was changed.

## 10. Known follow-up work (not implemented)

- **App restore on resume**: `listUnresolvedPurchases()` exists in `google-play-client.ts` but nothing currently calls it automatically on app foreground. Wire it into a top-level layout effect (e.g. `AppShell`) that resubmits any unresolved tokens to `/api/credits/google-play/verify` when the app regains focus, for the "closed the app mid-checkout" recovery path.
- **Purchase quantity** isn't read from Google's verification response or validated — the current client-side purchase flow doesn't support multi-quantity purchases, so this is a latent gap rather than an active one, but worth closing if that ever changes.
- **Acknowledge/consume retries**: if `acknowledge`/`consume` fail after credits are already granted (logged, not retried), Google will auto-refund the purchase after ~3 days if it's never acknowledged. Consider a scheduled job that re-attempts acknowledgement for any `GooglePlayPurchase` stuck in `GRANTED` (not yet `CONSUMED`) for longer than a few minutes.
- **Debt collection UX**: a wallet in debt (§6.7) blocks further spending, but there's no in-app messaging yet prompting the user to buy credits specifically to clear a debt versus a normal top-up — both currently show the same "buy credits" flow.
