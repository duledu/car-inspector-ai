# Second Opinion Audit — Google Play Billing Integration

Independent, adversarial review of the Google Play Billing implementation for Used Cars Doctor. Read-only — no files were modified. Written by a fresh pass over the actual code, not by re-summarizing the implementation's own design notes.

Audit date: 2026-08-05

---

## Readiness Score: **31 / 100**

The architecture is sound (config-driven product scope, server-side-only verification, CarVertical correctly isolated, Stripe genuinely untouched). But two **critical**, concretely exploitable defects were found in the money-handling code itself — not edge cases, but core to whether the wallet and refund system can be trusted — plus all the pre-existing infrastructure blockers (no signed AAB, no Play Console setup, no JDK in this environment) remain open. The score reflects that this cannot go anywhere near production traffic yet, even though the scaffolding is well-organized.

## Final Verdict: **NOT READY**

---

## Critical Blockers

### C1. Wallet balance race condition — concurrent spends can duplicate value

**Files:** `src/lib/credits/credit-wallet.ts:206-250` (`spendCredit`), `:143-180` (`grantCredits`), `:277-310` (`refundCredits`)

Every wallet mutation follows the same pattern: read `wallet.balance` inside the transaction (`tx.creditWallet.findUnique` / `.upsert`), compute `newBalance` in **application code**, then write it back as an absolute value:

```ts
// credit-wallet.ts:207-222 (spendCredit)
const wallet = await tx.creditWallet.findUnique({ where: { userId } })
if (wallet.balance < amount) { throw ... }
const newBalance = wallet.balance - amount
...
tx.creditWallet.update({ where: { id: wallet.id }, data: { balance: newBalance, ... } })
```

Prisma's interactive `$transaction` here runs under PostgreSQL's default **READ COMMITTED** isolation — no `{ isolationLevel: 'Serializable' }` option is passed anywhere, and `findUnique`/`upsert` are plain `SELECT`s, not `SELECT ... FOR UPDATE`. Two concurrent transactions can both read the same starting `balance` before either commits its `UPDATE` — a textbook lost-update race.

**Concretely exploitable path:** a user with 1 credit fires two concurrent `POST /api/credits/redeem` requests for two *different* vehicles (or the same vehicle with two different `productType`s costing 1 credit). Each request:
- has a **different** `idempotencyKey` (`redeem:${userId}:${vehicleId}:${productType}` — vehicleId differs, so the idempotencyKey unique constraint does **not** collide and cannot save you here),
- independently reads `balance = 1`, sees `1 >= 1`, proceeds,
- both write `balance = 0` and both call `grantPremiumAccess()` successfully.

Result: **one credit unlocks two reports.** The final stored balance (0) looks superficially correct, but two `CreditTransaction` rows now both claim `balanceBefore: 1` — the ledger itself becomes internally inconsistent, and the user received double value.

Note this is *not* the same as the (correctly handled) same-token double-grant case in §6 below — that case is protected because the idempotencyKey is deterministic per token. This case is a genuinely different, unprotected race because the idempotencyKey legitimately differs per request.

**Fix:** use atomic relative updates (`data: { balance: { decrement: amount } }`) combined with a `WHERE balance >= amount` guard (Prisma doesn't support conditional updates directly — either drop to `$queryRaw` with `UPDATE ... SET balance = balance - $1 WHERE balance >= $1 RETURNING *`, or use `SELECT ... FOR UPDATE` via raw SQL inside the transaction to serialize concurrent spenders of the same wallet). This applies to `grantCredits`, `spendCredit`, and `refundCredits` alike.

**Test coverage:** none. `tests/unit/credit-wallet.test.ts` mocks Prisma synchronously — every "concurrent" scenario in the suite (e.g. "returns current wallet on duplicate idempotencyKey") simulates the *result* of a race by pre-seeding a mock return value, it never exercises real interleaved execution. This bug would not be caught by the current test suite even after being fixed incorrectly.

### C2. RTDN webhook trusts unverified payload data behind weak auth — wallet-drain vector

**File:** `src/app/api/credits/google-play/notifications/route.ts:44-68` (`handleVoidedPurchase`), `:76-82` (auth check)

Two compounding problems:

1. **Authentication (line 79):** `providedToken !== expectedToken` is the *entire* verification that a request genuinely came from Google Cloud Pub/Sub. This is a shared secret in a URL query string, not Pub/Sub push authentication (OIDC). The setup doc is honest that this is the simple option (`GOOGLE_PLAY_BILLING_SETUP.md` §6), but the code has no path to anything stronger yet.

2. **Payload trust (lines 44-67):** `handleVoidedPurchase` takes `notification.purchaseToken`/`orderId`/`refundType` **directly from the parsed Pub/Sub message body**, looks it up only against *our own* `GooglePlayPurchase` table, and calls `refundCredits()` — it never re-fetches the purchase from `androidpublisher.purchases.products.get` to confirm with Google that a refund actually happened. Requirement 11 explicitly asked whether RTDN payload data is trusted directly instead of being re-verified — it is.

**Combined impact:** anyone who obtains the `GOOGLE_PLAY_RTDN_TOKEN` (log leakage, guessing, a misconfigured proxy, a former employee, etc.) can `POST` a fabricated `voidedPurchaseNotification` for **any `purchaseToken` value already in the database** and immediately trigger a real wallet debit for that user — with no independent confirmation from Google that anything was actually refunded. This is a genuine fraud/griefing vector, not a theoretical one: the token is the only gate, and once past it, the handler acts on the claim at face value.

There is also no rate limiting on this endpoint (unlike `/verify` and `/redeem`), so an attacker who obtains the token could iterate through known/enumerated tokens quickly.

**Fix:** in `handleVoidedPurchase`, before calling `refundCredits`, call `verifyGooglePlayPurchase()` (already exists) using the notification's `productId`/`purchaseToken` and confirm the purchase's actual current state with Google before acting. Upgrade the endpoint auth to Pub/Sub OIDC push authentication (verify the bearer token's issuer is `accounts.google.com`, audience matches your configured value, and email matches your Pub/Sub service account) rather than a static shared secret. Add rate limiting matching `/verify`/`/redeem`.

---

## High-Severity Findings

### H1. Google Play refunds don't revoke previously-granted access — Stripe refunds do

**Files:** `src/app/api/credits/google-play/notifications/route.ts:44-68` vs `src/modules/payments/payment.service.ts:231-251` (`onRefunded`)

Stripe's refund handler (`onRefunded`) explicitly does `prisma.accessGrant.updateMany({ where: { purchaseId }, data: { isActive: false, revokedAt: new Date() } })` — access is pulled back when a Stripe charge is refunded. `handleVoidedPurchase` (the Play equivalent) does **not** do this anywhere — it only adjusts the wallet balance and marks the `GooglePlayPurchase` row `REVOKED`.

**Confirmed exploit path (answering requirement 13 directly):** a user buys a 5-credit pack, immediately spends all 5 credits unlocking `FULL_INSPECTION_BUNDLE` for a vehicle (`grantPremiumAccess` runs, `AccessGrant.isActive = true`, `InspectionReport.status = ACTIVE`), then gets the purchase refunded/charged back through Google Play. `refundCredits()` correctly clamps their wallet balance down (never negative — the ledger math itself is safe), **but the already-granted report access is never revoked.** The user keeps full access to a report they no longer paid for.

This is architecturally harder than a one-line fix: because credits are a fungible generic currency (not earmarked per-purchase), there is no direct trace from "this specific Play purchase" to "these specific access grants it funded" once the credits have been spent and commingled with credits from other purchases. Fixing this properly needs a product decision (e.g., should a refund void the *n* most recently unlocked reports up to the refunded credit amount? Flag the account for manual review instead of auto-revoking? Accept the risk below some threshold?) before it can be a pure code fix.

### H2. Concurrent identical purchase-token submissions can hit an unhandled exception

**File:** `src/app/api/credits/google-play/verify/route.ts:87-96`

```ts
const purchaseRow = existing
  ?? await prisma.googlePlayPurchase.create({ data: { ..., purchaseToken, ... } })
```

`GooglePlayPurchase.purchaseToken` is `@unique` (`prisma/schema.prisma:647`). If two requests carrying the *same* token race past the `findUnique` check on line 76 before either has inserted its row, the second `create()` throws an unhandled Prisma P2002 error — there's no try/catch around it. This isn't a double-grant (the DB constraint correctly prevents two rows), but it does surface as an ungraceful 500 instead of the intended `ALREADY_GRANTED`/idempotent-replay response. Self-heals if the client retries (the second attempt will find `existing`), but it's a real correctness gap under load, and exactly the kind of thing requirement 6 asked to verify.

**Fix:** wrap the `create()` in a try/catch for P2002 and re-fetch by `purchaseToken` on conflict, mirroring the pattern already used elsewhere in this codebase (`credit-wallet.ts`'s `isUniqueConstraintError` helper).

---

## Medium-Severity Findings

### M1. Purchase quantity is never read or validated

**File:** `src/lib/payments/google-play-verification.ts:31-39` (interface), `:83-91` (mapping)

`GooglePlayVerifiedPurchase` has no `quantity` field — Google's `ProductPurchase` API response includes one, and it's dropped entirely. Requirement 5 explicitly asks whether quantity is validated; it is not, anywhere in the codebase. Given the current client-side purchase flow (`PaymentRequest` with a single `sku` in `data`, no quantity selector), this is likely not exploitable *today* because quantity is presumably always 1 — but that's an assumption about the client, not something the server enforces. If a future client change (or a modified/malicious client bypassing your own web UI and calling the API directly with a crafted purchase) ever produces a multi-quantity purchase, the server would silently grant only the flat per-SKU credit amount regardless of actual quantity purchased/paid for, with no validation either way.

### M2. "Restore after reinstall / app closed mid-checkout" is implemented but never invoked

**File:** `src/lib/billing/google-play-client.ts:101-110` (`listUnresolvedPurchases`)

The function exists and is correctly written, but nothing in the app calls it — confirmed via search, no references outside its own definition and the exported barrel. `GOOGLE_PLAY_BILLING_SETUP.md` §10 already flags this as "known follow-up work," which is honest, but the original task explicitly asked to "handle... users closing the app during checkout," and as shipped, that requirement is only half-met: the primitive exists, the actual recovery behavior does not.

### M3. No rate limiting on the RTDN notifications endpoint

Compounds C2 — see above.

### M4. No saga/outbox protection across the multi-step grant flow

**Files:** `verify/route.ts:87-183`, `redeem/route.ts:71-138`

Neither route wraps its *entire* multi-step flow (purchase-row bookkeeping → external Google API calls → credit grant → access grant) in one atomic unit — nor could it, since external API calls can't participate in a DB transaction. Each individual step (crediting the wallet; granting access) is internally atomic and the whole flow is *retry-safe* thanks to deterministic idempotency keys, which is the right design given the constraint. But a process crash between two steps (e.g., after `grantCredits` commits but before the `GooglePlayPurchase` row is marked `GRANTED`, or after `spendCredit` commits but before `grantPremiumAccess` runs and the process is killed rather than throwing) is not automatically reconciled — nothing currently retries a wallet spend that never got its access grant, beyond the explicit in-process refund rollback (`redeem/route.ts:118-138`), which only fires on a *catchable* error, not a process death. Low probability, worth acknowledging rather than treating the current design as fully bulletproof.

---

## Low-Severity / Informational

- **L1 — Non-constant-time token comparison.** `notifications/route.ts:79` uses `!==` on the RTDN shared secret. Timing side-channel risk is low in practice (network jitter dominates), but `crypto.timingSafeEqual` is trivial to add and is a defense-in-depth norm for token comparisons.
- **L2 — `document.referrer`-based TWA detection is a known-spoofable heuristic** (`src/utils/platform/is-twa.ts:15`). At the Android intent level, another app can in principle set a custom referrer extra when launching Chrome. This is **not currently a vulnerability** because nothing security-sensitive reads this value — it only decides which purchase UI to render client-side; the server never receives or trusts it. Confirmed by checking `verify/route.ts` and `redeem/route.ts`, neither of which import or reference `isRunningInTwa`. Worth documenting as a known limitation rather than treating it as provably unspoofable.
- **L3 — `rawPayload` JSON blob in `GooglePlayPurchase` duplicates the `purchaseToken`** that's already the row's own unique column. Harmless (not a "log" or "frontend" exposure per requirement 17 — it's our own access-controlled database), just redundant storage.
- **L4 — googleapis error-shape assumption unverified against a live sandbox.** `google-play-verification.ts:71` checks `err.code ?? err.status` for 404/400 to classify `INVALID_TOKEN`. This looks correct for the `googleapis` client's typical error shape but was not exercised against a real Play Developer API error response in this environment (no service account is configured) — recommend confirming during the sandbox testing pass described in the setup doc.

---

## Verification of the 27 Requested Checks

| # | Check | Result |
|---|---|---|
| 1 | Android purchases use Play Billing exclusively | **Pass** — `PremiumLockedState.tsx:255-279`, `InspectionReportAccessGate.tsx` (`androidPurchaseSlot`) hide the Stripe button on Android for every credit-unlockable product. |
| 2 | Web Stripe checkout unchanged | **Pass** — `payment.service.ts`'s `createCheckout`/webhook flow is untouched in behavior; the only change is `onPaymentSucceeded` delegating to the new shared `grantPremiumAccess()` helper, which reproduces the prior inline logic exactly (verified line-by-line against the extracted version) plus one additive audit-only ledger write. |
| 3 | CarVertical absent from Android mappings/UI/redemption | **Pass** — absent from `CREDIT_UNLOCKABLE_PRODUCTS` (`product-credit-costs.ts:27-33`), `redeem/route.ts:53-59` explicitly rejects it with `PRODUCT_NOT_AVAILABLE_ON_ANDROID`, `PremiumLockedState.tsx:255-272` shows no purchase affordance for it on Android. |
| 4 | Credits granted only after server-side verification | **Pass** — no code path grants credits without a preceding `verifyGooglePlayPurchase()` call returning `purchaseState === 0`; confirmed no client-callable grant endpoint exists. |
| 5 | Package name, product ID, purchase state, quantity, authenticated user validated | **Partial** — package name (`google-play-verification.ts:41-50`), product ID (`verify/route.ts:66-73`), purchase state (`verify/route.ts:128-142`), and user (`requireAuth`) are all validated. **Quantity is not** — see M1. |
| 6 | Same token can't grant twice, including concurrently | **Pass for identical-token replay** (idempotencyKey unique constraint causes the losing transaction to roll back — verified in `grantCredits`'s catch block). **See C1** for the separate, unprotected different-idempotencyKey wallet race, and **H2** for the ungraceful (but non-exploitable) `create()` race. |
| 7 | Verification + grant + ledger entry are atomic | **Partial** — the credit grant itself (wallet + ledger row) is one atomic `$transaction`. The overall multi-step flow (purchase bookkeeping → verify → grant → acknowledge/consume) is not one transaction, but is retry-safe via idempotency keys — see M4 for the crash-mid-flow caveat, and **C1** for the deeper concurrency problem. |
| 8 | Acknowledge/consume order and retry-safety | **Pass** — acknowledge then consume (`verify/route.ts:177-183`), matches Chrome's documented order; failures are caught and logged without breaking the response, so retries (including "already acknowledged" errors from Google) don't crash the flow. No background retry job for permanently-failed acknowledgements yet (documented as follow-up work). |
| 9 | Pending/cancelled/already-owned/restored/interrupted purchases | **Partial** — pending (`verify/route.ts:133-137`) and cancelled (`:128-131`) are correctly handled; already-owned/replay (`:77-82`) is correct. Restored/interrupted — see **M2**, the primitive exists but is unused. |
| 10 | RTDN authenticated as genuine Pub/Sub requests | **Fail** — see **C2**. Shared secret only, not Pub/Sub-specific authentication. |
| 11 | RTDN payload not trusted directly; re-fetched from Developer API | **Fail** — see **C2**. `handleVoidedPurchase` acts on the notification body directly. |
| 12 | Refunds/revocations/chargebacks can't be processed twice | **Pass** — `refundCredits`'s idempotencyKey (`google-play-void:${purchaseToken}`) is deterministic per token; a redelivered Pub/Sub message is a no-op on the second attempt. |
| 13 | What happens when a refund occurs after credits are already spent | **Determined precisely — see H1.** Wallet balance clamps safely to zero (no negative-balance corruption), but previously-granted report access is **not** revoked. Real "keep the report after a chargeback" gap. |
| 14 | Wallet cannot be exploited via refunds/concurrent redemptions/retries/negative balance | **Fail** — refund clamping and retry/idempotency are both handled correctly in isolation, but **C1** (concurrent redemptions) is a confirmed, concrete exploit. |
| 15 | Purchase history tied to correct authenticated user | **Pass** — `purchases/route.ts` filters by `auth.userId` from `requireAuth`, not any client-supplied ID. |
| 16 | Stripe creates only a zero-impact audit entry, cannot generate Android credits | **Pass** — `recordExternalPurchaseAudit` (`credit-wallet.ts:341-364`) writes `amount: 0` and never calls `creditWallet.update`; confirmed no code path lets a Stripe purchase reach `grantCredits`. |
| 17 | No service-account credentials or purchase tokens exposed in frontend/logs | **Pass, with a caveat** — `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is read only in `google-play-auth.ts`, imported only by server route files. Purchase tokens are masked in logs (`verify/route.ts`'s `maskToken`) everywhere they're logged. Necessary client-side handling of raw tokens (client → server, over authenticated HTTPS POST) is required by the protocol and is not a leak. |
| 18 | Rate limiting appropriate for verify/redeem/history/RTDN | **Partial** — verify and redeem: 10/60s per user, reasonable. Purchase history (GET, read-only, authenticated): none, low risk. **RTDN: none — see M3**, and this one matters given C2. |
| 19 | Digital Goods API / Payment Request API correctness for a Bubblewrap TWA | **Pass** — `google-play-client.ts` matches Chrome's documented pattern: `getDigitalGoodsService('https://play.google.com/billing')`, `PaymentRequest` with that same method string, reading `paymentResponse.details.purchaseToken` (with a `.token` fallback), explicit `complete('success'/'fail')`. |
| 20 | Feature detection doesn't rely on a spoofable query param or UA alone | **Pass, with a documented caveat** — see L2. Uses `document.referrer`, not a query param or UA string; nothing security-sensitive depends on it. |
| 21 | Five `inspection_credit_1..5` products as consumable one-time products | **Pass** — `google-play-products.ts`, consumed server-side after grant (`verify/route.ts:179`). |
| 22 | Costs: INSPECTION_REPORT=1, AI_DEEP_SCAN=2, FULL_INSPECTION_BUNDLE=5 | **Pass** — exact match, `product-credit-costs.ts:28-30`. |
| 23 | Migrations safe and production-compatible | **Pass** — both migrations are purely additive (`CREATE TYPE`/`CREATE TABLE`, and `ALTER TYPE ... ADD VALUE`). The `STRIPE` enum-value migration was actually applied against the live dev database during implementation and confirmed successful, not just written. |
| 24 | Tests cover real race conditions, not just mocked happy paths | **Fail, honestly** — the new test files (`credits-google-play-verify.test.ts`, `credits-redeem.test.ts`, extended `credit-wallet.test.ts`) cover many *failure states* well (insufficient credits, already purchased, invalid/cancelled/pending token, duplicate-token replay, grant-failure rollback) but every scenario runs sequentially against a mocked Prisma client — none exercise genuine concurrent/interleaved execution. **C1 would not have been caught by this suite.** |
| 25 | Re-run type-check, tests, build | **Done — see below.** All pass except one pre-existing, unrelated failure. |
| 26 | Target SDK confirmed; recommend API 36 | `usedcarsdoctor-bubblewrap/app/build.gradle:54,58,59`: `compileSdkVersion 36`, `minSdkVersion 23`, **`targetSdkVersion 35`**. Unchanged since the original readiness audit. Given the August 31, 2026 deadline for new submissions to require API 36, and `compileSdkVersion` is already there, **recommend bumping `targetSdkVersion` to 36 now** — low-risk, tooling already supports it. |
| 27 | What remains before internal-testing upload | See the ordered list below. |

---

## Commands Run and Results

| Command | Result |
|---|---|
| `npm run type-check` (`tsc --noEmit`) | Clean, no errors |
| `npm test` (`jest`) | 358/358 tests pass. 1 suite (`tests/integration/payment.service.test.ts`) fails to *load* — `STRIPE_SECRET_KEY environment variable is not set`, thrown by the module-level `payment.service.ts:254` singleton at import time. Pre-existing, unrelated to this feature (confirmed identical failure signature in the original readiness audit before this work began). |
| `npm run build` (`next build`) | Compiles cleanly; all 5 new/changed API routes (`/api/credits/google-play/verify`, `/redeem`, `/notifications`, `/purchases`, plus the unchanged `/balance`) appear correctly in the route manifest. |
| `grep -c targetSdkVersion` / manual read of `app/build.gradle` | `targetSdkVersion 35`, `compileSdkVersion 36` — confirmed unchanged from the prior audit. |
| `which java` | Not found — same limitation as the original readiness audit; this environment cannot run `bubblewrap build`/sign an AAB. |
| `unzip -l app-release.aab \| grep META-INF/(MANIFEST\|CERT)` | No match — the existing AAB at `usedcarsdoctor-bubblewrap/app/build/outputs/bundle/release/app-release.aab` is still unsigned (unchanged file, same as the original audit; no new build was produced during the billing implementation). |

---

## Strict Ordered Next Steps

1. **Fix C1** — replace read-then-write balance math in `grantCredits`/`spendCredit`/`refundCredits` with atomic `decrement`/`increment` operations guarded by a `WHERE balance >= amount` condition (raw SQL or `SELECT ... FOR UPDATE`), so concurrent spends against the same wallet can't both succeed against the same pre-race balance.
2. **Fix C2** — in `handleVoidedPurchase`, re-verify the purchase against `androidpublisher.purchases.products.get` before calling `refundCredits`; upgrade the RTDN endpoint to real Pub/Sub push authentication (OIDC token verification) instead of a shared-secret query param.
3. **Decide and implement H1's product question** — how a Play refund should affect already-spent credits' resulting access grants (auto-revoke most-recent, flag for review, or accept the risk under some threshold) — then implement whichever is chosen.
4. **Fix H2** — catch the P2002 race in `verify/route.ts`'s `googlePlayPurchase.create()` and fall back to re-fetching the existing row.
5. Add rate limiting to the RTDN notifications endpoint (M3) and constant-time comparison for the shared token (L1) as part of the C2 fix.
6. Add quantity handling/validation (M1) and wire `listUnresolvedPurchases()` into an app-resume hook (M2).
7. Add at least one genuinely concurrent test (e.g., `Promise.all` of two real calls against a test database, or a targeted unit test that simulates two overlapping reads before either write commits) to prove C1 is actually fixed — the current mocked-sequential suite cannot verify this.
8. Re-run `type-check`, `test`, `build` after the above; re-audit before proceeding further.
9. Only after 1–8: get a JDK + Android SDK available, run `bubblewrap update` then `bubblewrap build`, sign with the existing keystore.
10. Create the 5 Play Console products, provision the service account with the required API access, set up the RTDN Pub/Sub topic/subscription, and set the 3 new env vars in production.
11. Upload the signed AAB to Internal Testing, then add the Play App Signing certificate fingerprint to `assetlinks.json`.
12. Bump `targetSdkVersion` to 36 (§26) before any production submission.
13. Produce the still-missing store listing assets (feature graphic, screenshots) — carried over from the original readiness audit, unaffected by this billing work.

---

## Verdict: **NOT READY**

The architecture and scope discipline (config-driven products, clean CarVertical exclusion, genuinely untouched Stripe path) are solid. But two critical, concretely exploitable defects sit in the code that actually moves money and credits — a wallet double-spend race and an under-verified refund webhook — plus the already-known infrastructure gaps (unsigned AAB, no JDK, no Play Console setup) that haven't changed since the original readiness audit. This needs the fixes in steps 1–8 above, re-verified with real concurrency testing, before it's safe to expose to real users — independent of the separate, already-tracked Play Console/signing checklist.
