# Final Billing Release Gate

Audit date: 2026-08-29
Scope: read-only final verification of exactly two prior fixes — the RTDN voided-purchase pagination fix and the premium AI payment/entitlement gate fix. No files were modified during this audit. Wallet locking, debt-refund logic, and RTDN OIDC authentication were only re-read to confirm they were not touched by either fix (regression check), not re-audited on their own merits.

## A. RTDN Pagination Fix

Status: **PAGINATION VERIFIED**

Verified against the current code in `src/lib/payments/google-play-verification.ts`:

- `iterateVoidedPurchasePages()` (lines 166–207) calls `client.purchases.voidedpurchases.list()` in a loop. After each page it reads `response.data.tokenPagination?.nextPageToken` (line 203) and, when present, passes it back as `token` on the next request (line 189: `...(pageToken ? { token: pageToken } : {})`) — the correct request-param name per the `googleapis` v3 type definitions (`Params$Resource$Purchases$Voidedpurchases$List.token`).
- `wasPurchaseVoided()` (lines 234–239) consumes this generator directly and returns `true` the moment `page.some(v => v.purchaseToken === purchaseToken)` matches — proven for page 1, page 2, and later pages by `tests/unit/google-play-verification.test.ts` ("finds the target purchase on the first page", "...on the second page by following nextPageToken", "...after several pages").
- Loop termination: when `nextPageToken` is absent, the generator `return`s (line 204) — no further requests are made. Verified by the "returns false once the final page is reached without a match" test (exactly 2 calls, not more).
- Defensive maximum-page limit: `MAX_VOIDED_PURCHASES_PAGES = 20` (line 156), checked at the top of every loop iteration (lines 174–179). Exceeding it throws `GooglePlayVerificationError('VOIDED_LIST_PAGINATION_LIMIT')` rather than returning "not voided" — verified by the "fails closed instead of looping forever on malformed/repeating pagination tokens" test, which asserts the call count never exceeds 20 and the promise rejects with that exact code.
- Google API failure on any page fails closed: every `list()` call is wrapped in its own `try/catch` that rethrows `VOIDED_LIST_FAILED` (lines 181–193); this propagates through `for await` uncaught by `wasPurchaseVoided`/`listVoidedPurchases`. Verified for both page 1 and page 2+ failures ("fails closed (throws, does not return false) when the first/a later page request fails").
- No wallet mutation on incomplete verification: `src/app/api/credits/google-play/notifications/route.ts:113-121` wraps `wasPurchaseVoided()` in `try/catch`; any thrown error is logged and the function returns *before* `refundCredits()` is reached (line 132). Re-confirmed unchanged — zero diff against the last commit.
- Purchase matching is exact: `page.some(v => v.purchaseToken === purchaseToken)` (line 236) is a strict equality check on `purchaseToken` only; `orderId` is not used for matching at all, so it cannot cause a cross-order or cross-user match. Verified by the "never matches a different purchaseToken (exact match only)" test (`tok-targetXYZ` and `Xtok-target` do not match `tok-target`).
- Duplicate RTDN delivery remains idempotent: the route derives `idempotencyKey: google-play-void:${notification.purchaseToken}` (route.ts:132-138), backed by `CreditTransaction.idempotencyKey @unique` and P2002 handling in `refundCredits()` — this code path is untouched (zero diff vs. last commit) and is separately covered by `tests/integration/credits-google-play-notifications.test.ts`'s "repeated delivery... calls refundCredits with the same idempotencyKey" test.

Test evidence: `tests/unit/google-play-verification.test.ts` (9 pagination-specific tests, all passing) + `tests/integration/credits-google-play-notifications.test.ts` (unchanged, all passing).

## B. Payment / Entitlement Gate

Status: **PAYMENT GATE VERIFIED**

Verified against current code:

- **`POST /api/inspection/analyze-photo`** (`analyze-photo/route.ts`): `vehicleId` is now a required Zod field (`z.string().min(1)`, no `.optional()`). Ownership (`verifyVehicleOwnership`) and entitlement (`hasAiAnalysisAccess`) checks run unconditionally at lines 751–754 — no `env.features.inspectionAccessGate` branch exists anywhere in the file (confirmed by grep: `env` is not imported or referenced except via `process.env.OPENAI_API_KEY`).
- **`POST /api/ai-analysis/analyze`**: ownership check (`prisma.vehicle.findFirst`) at lines 90–97 and entitlement check (`hasAiAnalysisAccess`) at lines 103–107 both run unconditionally; no feature-flag branch remains.
- **`POST /api/inspection/score`**: unchanged (zero diff vs. last commit) — still gated by `startReportGeneration()`, which requires an `ACTIVE` `InspectionReport` row and fails closed (`ACCESS_REQUIRED`) if the access table is unreachable.
- **`POST /api/report/pdf`**: unchanged (zero diff vs. last commit) — gated by `canViewInspectionReport(access)` (ACTIVE or LOCKED) at line 122–125 *and* independently requires `scoringService.getLatest()` to return a real cached score (line 147–150) before building the PDF.

Scenario-by-scenario:

1. **Zero credits / no PremiumPurchase / no AccessGrant, owns vehicle** → `hasAiAnalysisAccess()` (`access.ts:92-96`) resolves `false` for `DRAFT`/`NONE` InspectionReport status with no matching `AccessGrant`; both AI routes return `403 ACCESS_REQUIRED`. Score/PDF independently require an `ACTIVE` report or cached score, which don't exist in this state → `403`. Verified end-to-end via mocked-boundary tests reproducing this exact DB state (`tests/unit/inspection-ai-analysis-access.test.ts`: "the confirmed bypass: DRAFT status with no entitlement is rejected"; `tests/integration/inspection-analyze-photo.test.ts` and `ai-analysis-analyze.test.ts`: "rejects (403 ACCESS_REQUIRED)..."). No live test database is provisioned in this environment (no `TEST_DATABASE_URL`), so this is the verification method used, not a live HTTP round-trip against Postgres.
2. **AI_DEEP_SCAN entitlement**: `PRODUCTS_GRANTING.AI_DEEP_SCAN = ['AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE']` (`entitlements.ts:25`) — a standalone `AI_DEEP_SCAN` `AccessGrant` satisfies Deep Scan. It does **not** flip `InspectionReport` status to `ACTIVE` (only `INSPECTION_REPORT`/`FULL_INSPECTION_BUNDLE` purchases do, per `premium-access.ts:52-58`), so `startReportGeneration`/PDF access remain denied. Verified by `inspection-ai-analysis-access.test.ts` ("B: a standalone AI_DEEP_SCAN entitlement grants access even with DRAFT... report status").
3. **FULL_INSPECTION_BUNDLE**: `grantPremiumAccess()` now activates the `InspectionReport` row for `FULL_INSPECTION_BUNDLE` as well as `INSPECTION_REPORT` (`premium-access.ts:52-58`), and its own `AccessGrant(FULL_INSPECTION_BUNDLE)` row satisfies the `AI_DEEP_SCAN` capability via the same map — one purchase, one `spendCredit()` call, both capabilities unlocked. Verified by `credits-redeem.test.ts`'s "spends 5 credits for FULL_INSPECTION_BUNDLE" test, which asserts `grantAccess` is called exactly once as part of a single redeem call (no second charge path exists in the route).
4. **INSPECTION_REPORT only**: unchanged report-unlock flow via `ACTIVE` status; `hasAiAnalysisAccess` returns `true` for `ACTIVE` regardless of which product produced it, matching the pre-existing funnel design (photo analysis is needed to build the report the user already paid for). Verified by `inspection-ai-analysis-access.test.ts` ("D: INSPECTION_REPORT-only purchase (ACTIVE report) allows Deep Scan").
5. **Cross-user vehicle**: `verifyVehicleOwnership`/`prisma.vehicle.findFirst` scoped to `{ id: vehicleId, userId }` reject before entitlement is even consulted; both integration test suites explicitly assert entitlement is irrelevant once ownership fails ("...even if entitlement would otherwise pass" → `404`).
6. **`FEATURE_INSPECTION_ACCESS_GATE=false`**: no code path reads this flag in either AI route anymore; explicitly re-verified by setting the env var to `'false'`, `'true'`, and unset across repeated calls in the same test — all three still return `403` for an unentitled user (`inspection-analyze-photo.test.ts` / `ai-analysis-analyze.test.ts`, "entitlement gate cannot be bypassed regardless of FEATURE_INSPECTION_ACCESS_GATE value").
7. **Direct API calls**: all of the above checks run in the route handler itself, before any AI/DB work, independent of any frontend — there is no client-trusted `paid`/`productType` field read anywhere in these four routes' authorization logic.

Additional checks:

- `vehicleId` required: confirmed (analyze-photo schema, ai-analysis schema already required it).
- Ownership checked server-side: confirmed in all four routes.
- Entitlement derived only from server-side DB records: `hasEntitlement()` queries `prisma.accessGrant.findFirst` exclusively; no request body field feeds into the entitlement decision.
- DRAFT/NONE do not count as paid access: confirmed by explicit unit tests.
- AccessGrant mapping is configuration-driven: `PRODUCTS_GRANTING` in `entitlements.ts` is a single static map; adding a future bundle requires no route changes.
- Client `productType` cannot grant access: no route reads a client-supplied `productType` (or any client field) as an entitlement source; `/api/credits/redeem`'s `productType` only selects which product to *purchase*, and access is granted only after a real `spendCredit()` success.
- AI work is not charged once per photo: `analyze-photo`/`ai-analysis/analyze` never call `spendCredit`/`grantPremiumAccess` — charging happens exactly once, in `/api/credits/redeem`, at purchase time.
- Bundle purchase charged only once: confirmed — `getCreditCost('FULL_INSPECTION_BUNDLE')` is a single fixed cost (5), spent once per redeem call; `grantPremiumAccess`'s dual-entitlement effect happens after that single spend, not as a second charge.
- Rate limiting is active: `analyze-photo` (60/5min/user), `ai-analysis/analyze` (20/5min/user), promo redemption (5/min/user) — all confirmed present in the current file contents and exercised by passing tests.
- Admin behavior does not leak to USER accounts: neither `analyze-photo` nor `ai-analysis/analyze` reference `auth.role` or any admin bypass at all — grep confirms zero matches. The only admin bypass in the codebase (`requireAdmin`, `/api/credits/grant-test`) uses a strict `role !== 'ADMIN'` check and is architecturally unreachable from these four routes.

Test evidence: 6 new/updated test files, 34 tests specific to this fix, all passing (`inspection-analyze-photo.test.ts`, `ai-analysis-analyze.test.ts`, `inspection-access.test.ts`, `payments-entitlements.test.ts`, `inspection-ai-analysis-access.test.ts`, `promo-codes.test.ts`, plus the corrected assertion in `credits-redeem.test.ts`).

## C. Regression Check

All confirmed intact:

- Android uses Google Play Billing: `src/lib/billing/google-play-client.ts` and `/api/credits/google-play/verify` untouched (zero diff).
- Web uses Stripe: `PaymentService`/`StripeAdapter`/`/api/payment/*` untouched (zero diff).
- Stripe does not create Android spendable credits: `recordExternalPurchaseAudit()` (`credit-wallet.ts`) untouched, still writes `amount: 0` and never touches `CreditWallet.balance`.
- Wallet locking (`SELECT ... FOR UPDATE`) unchanged: `git diff --stat` against the last commit shows zero changes to `src/lib/credits/credit-wallet.ts`.
- Debt-based refund model unchanged: same file, zero diff.
- RTDN OIDC authentication unchanged: zero diff on `src/app/api/credits/google-play/notifications/route.ts`.
- Google purchase server verification (`purchases.products.get`) unchanged: `verifyGooglePlayPurchase()` in `google-play-verification.ts` is byte-identical to before the pagination fix; only `listVoidedPurchases`/`wasPurchaseVoided`/the new `iterateVoidedPurchasePages` helper changed.
- CarVertical remains outside Android billing: `product-credit-costs.ts` and `src/modules/integrations/carvertical/` show zero diff — `CARVERTICAL_REPORT` is still absent from `CREDIT_UNLOCKABLE_PRODUCTS`.
- No secrets exposed client-side: `promo-codes.ts` and `entitlements.ts` are imported exclusively by server route handlers and prisma-importing lib modules (grep-verified, no `'use client'` importer); no new environment variable or credential was introduced by either fix.

## D. Safe Verification

Commands run against the current working tree:

- `npm run type-check` → **passed**, zero errors.
- `npm test` → **424 passed, 424 total**; 1 suite (`tests/integration/payment.service.test.ts`) fails to *load* with `STRIPE_SECRET_KEY environment variable is not set` at `stripe.adapter.ts:24` — this is the same pre-existing, unrelated Stripe test-environment issue documented in prior audits (no `STRIPE_SECRET_KEY` is set in this test environment; it is not a regression from either fix, and no test assertion failed). All 83 tests directly covering the two audited fixes pass, including the full `google-play-verification.test.ts`, `credits-google-play-notifications.test.ts`, `inspection-analyze-photo.test.ts`, `ai-analysis-analyze.test.ts`, `inspection-access.test.ts`, `credits-redeem.test.ts`, `payments-entitlements.test.ts`, `inspection-ai-analysis-access.test.ts`, and `promo-codes.test.ts` suites.
- `npm run build` → **passed**, all routes compiled successfully including `/api/credits/google-play/notifications`, `/api/inspection/analyze-photo`, `/api/ai-analysis/analyze`, `/api/inspection/score`, and `/api/report/pdf`.

## E. Final Output

- RTDN pagination status: **PAGINATION VERIFIED**
- Payment gate status: **PAYMENT GATE VERIFIED**
- Regression status: **no regressions found** in wallet locking, debt-refund handling, RTDN OIDC auth, Google purchase verification, Stripe/Android separation, or CarVertical exclusion — all confirmed byte-identical to the pre-fix commit.
- Tests/type-check/build status: type-check clean; 424/424 tests passing with 1 pre-existing unrelated Stripe test-environment load failure (not a regression); build passed.
- Remaining CRITICAL/HIGH issue directly related to these two areas: **none found.**

## Final Verdict

**BILLING RELEASE GATE PASSED**
