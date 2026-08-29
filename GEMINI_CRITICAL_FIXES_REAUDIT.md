# Final Critical Fixes Re-Audit

Audit date: 2026-08-29  
Scope: read-only re-audit of only the three prior critical/high findings in `GEMINI_GOOGLE_PLAY_SECOND_OPINION.md` and `GOOGLE_PLAY_READINESS_AUDIT.md`.

## A. Executive Summary

Two of the three targeted fixes are production-safe based on actual code evidence:

- C1 wallet race condition: VERIFIED FIXED.
- H1 debt-based refund handling: VERIFIED FIXED.

C2 RTDN security is PARTIALLY FIXED. The endpoint now requires Google OIDC authentication, keeps the shared secret only as an additional gate, uses timing-safe comparison, and independently calls Google's `purchases.voidedpurchases.list` before debiting a wallet. However, the authoritative voided-purchase lookup reads only the first page of Google results. Google documents token pagination for this endpoint through `tokenPagination.nextPageToken` and `pageSelection.token`; this implementation never supplies or follows a page token. A legitimate voided purchase that is not on the first page can be treated as "not voided", causing fail-closed behavior in the narrow webhook-auth sense but fail-open for refund accounting.

Final verdict: FIXES INCOMPLETE.

## B. C1 Wallet Race Condition

Status: VERIFIED FIXED

Verified facts:

- `src/lib/credits/credit-wallet.ts:117-123` defines `lockWalletForUpdate(tx, userId)` and executes raw SQL:
  - `SELECT id, "userId", balance, "lifetimePurchased", "lifetimeSpent"`
  - `FROM credit_wallets WHERE "userId" = ${userId} FOR UPDATE`
- The predicate locks the correct wallet row by `CreditWallet.userId`, which is unique in `prisma/schema.prisma:588-592`.
- `grantCredits()` runs an interactive Prisma transaction at `src/lib/credits/credit-wallet.ts:183-228`.
- `grantCredits()` creates/ensures the wallet row inside that same transaction with `tx.creditWallet.upsert()` at `src/lib/credits/credit-wallet.ts:186-190`, then locks it at `src/lib/credits/credit-wallet.ts:192-196`, and only then calculates `newBalance = wallet.balance + amount` at `src/lib/credits/credit-wallet.ts:198`.
- `grantCredits()` updates the wallet and creates the `CreditTransaction` ledger row inside the same Prisma transaction at `src/lib/credits/credit-wallet.ts:200-225`.
- `spendCredit()` starts a transaction at `src/lib/credits/credit-wallet.ts:254`, locks the wallet before balance checks at `src/lib/credits/credit-wallet.ts:255`, checks negative debt and insufficient balance at `src/lib/credits/credit-wallet.ts:265-277`, calculates the deduction at `src/lib/credits/credit-wallet.ts:279`, then mutates the wallet and writes the ledger in the same transaction at `src/lib/credits/credit-wallet.ts:281-304`.
- `refundCredits()` starts a transaction at `src/lib/credits/credit-wallet.ts:341`, ensures the wallet row exists at `src/lib/credits/credit-wallet.ts:342-346`, locks it at `src/lib/credits/credit-wallet.ts:348-351`, calculates the refund adjustment at `src/lib/credits/credit-wallet.ts:353`, then updates balance and writes the ledger atomically at `src/lib/credits/credit-wallet.ts:355-375`.
- Duplicate idempotency keys are still protected by `CreditTransaction.idempotencyKey @unique` in `prisma/schema.prisma:625`; service code catches Prisma P2002 at `src/lib/credits/credit-wallet.ts:229-233`, `312-315`, and `379-383`.

Database/transaction reasoning:

- PostgreSQL `SELECT ... FOR UPDATE` row locks are transaction-scoped. Because `lockWalletForUpdate()` receives the Prisma transaction client and is called inside the same interactive transaction that later updates `credit_wallets` and inserts `credit_transactions`, concurrent mutations for the same `userId` serialize at the row lock.
- Two concurrent `spendCredit()` calls with different idempotency keys cannot both spend the same available credit: the second transaction cannot read the locked row until the first commits; it then sees the updated balance before its own balance check.
- Concurrent grants and refunds also serialize on the same wallet row, so absolute-value writes no longer lose updates.

Edge cases:

- Missing wallet rows: `spendCredit()` fails with `WALLET_NOT_FOUND` after the lock returns null (`src/lib/credits/credit-wallet.ts:255-259`). `grantCredits()` and `refundCredits()` upsert before locking (`src/lib/credits/credit-wallet.ts:186-190`, `342-346`).
- Wallet creation race: `CreditWallet.userId` is unique (`prisma/schema.prisma:590`) and both grant/refund use Prisma upsert before locking.
- Rollback behavior: wallet update and ledger create occur inside the same `$transaction`; a failed ledger insert rolls back the balance mutation.
- Deadlock risk: low for this code path because each wallet operation locks only one row and there is no multi-wallet lock ordering problem in the inspected functions.
- Stale balance reads: the balance used for mutation comes from the locked row, not a pre-lock read.

Assumptions:

- Production database is PostgreSQL-compatible with `SELECT ... FOR UPDATE`; this is consistent with the prior PostgreSQL-focused audit and Prisma/Postgres usage, but I did not inspect a live database connection.
- `grantCredits()` is not exposed as an arbitrary public API. In isolation, its `purchaseToken` duplicate pre-check at `src/lib/credits/credit-wallet.ts:168-180` is not backed by a unique index on `CreditTransaction.purchaseToken` (`prisma/schema.prisma:636` is only an index), but the public Google Play verification route uses a deterministic idempotency key and `GooglePlayPurchase.purchaseToken @unique` (`prisma/schema.prisma:648`).

Test note:

- Existing tests mock the Prisma transaction and `$queryRaw`; they verify intended call behavior but are not proof of database-level concurrency safety. A real integration test against a disposable PostgreSQL database could exercise two concurrent `spendCredit()` calls with different idempotency keys and assert exactly one succeeds.

## C. C2 RTDN Security

Status: PARTIALLY FIXED

Verified fixed facts:

- `src/app/api/credits/google-play/notifications/route.ts:68-87` requires an `Authorization` header starting with `Bearer ` and calls `OAuth2Client.verifyIdToken({ idToken, audience })` at `src/app/api/credits/google-play/notifications/route.ts:76-78`.
- OIDC audience validation is performed by `verifyIdToken(..., audience)` using `GOOGLE_PLAY_RTDN_OIDC_AUDIENCE` from `src/app/api/credits/google-play/notifications/route.ts:69`.
- Issuer validation accepts only `https://accounts.google.com` or `accounts.google.com` at `src/app/api/credits/google-play/notifications/route.ts:80`.
- Service-account email validation checks `payload.email === GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` and `email_verified === true` at `src/app/api/credits/google-play/notifications/route.ts:70-82`.
- Missing OIDC config fails closed: if `GOOGLE_PLAY_RTDN_OIDC_AUDIENCE` or `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` is absent, `verifyPubSubOidcToken()` returns false at `src/app/api/credits/google-play/notifications/route.ts:69-72`; the route returns 401 at `src/app/api/credits/google-play/notifications/route.ts:149-153`.
- Invalid or missing bearer tokens are rejected: missing/malformed headers return false at `src/app/api/credits/google-play/notifications/route.ts:73`; verification exceptions are caught and return false at `src/app/api/credits/google-play/notifications/route.ts:76-86`.
- `GOOGLE_PLAY_RTDN_TOKEN` is no longer the sole boundary. The route checks OIDC first at `src/app/api/credits/google-play/notifications/route.ts:149-153`, then checks the shared token at `src/app/api/credits/google-play/notifications/route.ts:155-160`.
- Shared-secret comparison is timing-safe for equal-length strings through `crypto.timingSafeEqual()` in `src/app/api/credits/google-play/notifications/route.ts:55-60`.
- The notification payload is treated as a signal before refunding: `handleVoidedPurchase()` loads the local purchase by `purchaseToken` at `src/app/api/credits/google-play/notifications/route.ts:95-102`, then calls `wasPurchaseVoided()` at `src/app/api/credits/google-play/notifications/route.ts:113-120`; no wallet debit occurs unless that returns true (`src/app/api/credits/google-play/notifications/route.ts:122-138`).
- The Google Play Developer API voided-purchase endpoint is used at `src/lib/payments/google-play-verification.ts:165-172` via `client.purchases.voidedpurchases.list({ packageName, startTime, endTime, maxResults: 1000, type: 0 })`.
- Google API failure fails closed for wallet mutation: `listVoidedPurchases()` throws `VOIDED_LIST_FAILED` on API errors at `src/lib/payments/google-play-verification.ts:180-182`; `handleVoidedPurchase()` catches that and returns before refunding at `src/app/api/credits/google-play/notifications/route.ts:113-121`.
- Duplicate RTDN delivery is idempotent at the wallet level because the route derives the same idempotency key, `google-play-void:${notification.purchaseToken}`, at `src/app/api/credits/google-play/notifications/route.ts:132-138`, and `refundCredits()` catches duplicate ledger-key P2002 at `src/lib/credits/credit-wallet.ts:379-383`.
- Concurrent duplicate RTDN requests are protected by the wallet row lock and ledger idempotency unique key: both may call `refundCredits()`, but only one ledger insert with the same idempotency key can commit; the duplicate path returns the current wallet.
- Payload manipulation is constrained by server-side lookup: `notification.purchaseToken` must match an existing `GooglePlayPurchase` row (`src/app/api/credits/google-play/notifications/route.ts:95-102`), and the wallet debit uses that row's `purchase.userId` and `purchase.creditsGranted`, not user-supplied user or amount fields (`src/app/api/credits/google-play/notifications/route.ts:132-138`).

Remaining high issue directly related to C2:

- `listVoidedPurchases()` fetches only one page. It sets `maxResults: 1000` but does not read `response.data.tokenPagination?.nextPageToken`, does not pass `pageSelection.token`, and does not loop (`src/lib/payments/google-play-verification.ts:165-179`).
- `wasPurchaseVoided()` calls `listVoidedPurchases()` once and searches only that returned array (`src/lib/payments/google-play-verification.ts:191-193`).
- Google documents that `purchases.voidedpurchases.list` returns `tokenPagination` and supports page tokens; if there are more results than `maxResults`, additional results are available on later pages. Source: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases/list
- Therefore the implementation can falsely conclude "not voided" if the target purchase is on another page. The handler then ignores the refund at `src/app/api/credits/google-play/notifications/route.ts:122-130`.

Time-window handling:

- The implementation uses a default 30-day lookback at `src/lib/payments/google-play-verification.ts:159`, computes `startTime` and `endTime` at `src/lib/payments/google-play-verification.ts:162-163`, and passes both to Google at `src/lib/payments/google-play-verification.ts:166-170`.
- Google documents that `startTime` cannot be older than 30 days for this endpoint. The code is aligned with that maximum window.
- Assumption: RTDN voided-purchase notifications arrive close enough to the void event that a 30-day lookback is sufficient. I did not verify delivery timing from a live Pub/Sub subscription.

Purchase matching:

- Matching by exact `purchaseToken` at `src/lib/payments/google-play-verification.ts:191-193` avoids accidentally matching a different purchase token.
- `orderId`, `packageName`, `productId`, and `notificationType` from the RTDN body are not used to decide the wallet user or amount. That reduces cross-user manipulation risk. The package scope for the Google API call comes from `getPackageName()` in `src/lib/payments/google-play-verification.ts:160-161`, not the RTDN body.

Assumptions:

- `google-auth-library`'s `verifyIdToken()` performs cryptographic token verification; this is the purpose of that library call, but I did not fetch Google signing keys or validate a live token.
- The configured Pub/Sub push subscription will actually mint OIDC tokens for the exact audience and service account expected by these env vars.

## D. H1 Debt-Based Refund Handling

Status: VERIFIED FIXED

Verified facts:

- `CreditWallet.balance` is an `Int` with default zero at `prisma/schema.prisma:588-593`; Prisma/PostgreSQL integers support negative values unless constrained, and no non-negative constraint is present in the Prisma model shown.
- `refundCredits()` does not clamp to zero. It computes `newBalance = wallet.balance - amount` at `src/lib/credits/credit-wallet.ts:353` and writes that exact value at `src/lib/credits/credit-wallet.ts:356-359`.
- Refund ledger rows record the full negative adjustment: `type: 'REFUND'`, `provider: 'GOOGLE_PLAY'`, `amount: -amount`, `balanceBefore: wallet.balance`, and `balanceAfter: newBalance` at `src/lib/credits/credit-wallet.ts:361-372`.
- Example verified from code: if balance is 1 and amount is 5, `newBalance` is -4 and the ledger amount is -5.
- `spendCredit()` blocks all spending while in debt: it checks `wallet.balance < 0` before the ordinary insufficient-credit check and throws `NEGATIVE_BALANCE_DEBT` at `src/lib/credits/credit-wallet.ts:261-270`.
- `/api/credits/redeem` maps `NEGATIVE_BALANCE_DEBT` to HTTP 402 with code `NEGATIVE_BALANCE_DEBT` at `src/app/api/credits/redeem/route.ts:80-89`.
- Valid future Google Play purchases naturally repay debt. `grantCredits()` locks the wallet, computes `wallet.balance + amount`, increments `lifetimePurchased`, and writes a purchase ledger row at `src/lib/credits/credit-wallet.ts:192-225`; there is no debt reset or deletion path.
- Existing AI reports are not automatically deleted or revoked by Google Play refunds. The RTDN route only calls `refundCredits()` and updates `GooglePlayPurchase.status` to `REVOKED` at `src/app/api/credits/google-play/notifications/route.ts:132-140`; it does not update `AccessGrant`, `PremiumPurchase`, or `InspectionReport`.
- In contrast, Stripe refunds explicitly revoke access at `src/modules/payments/payment.service.ts:231-250`; that behavior is confined to Stripe's `onRefunded()` handler and is not called by the Google Play RTDN route.
- The Android premium unlock route goes through `spendCredit()` before `grantPremiumAccess()` at `src/app/api/credits/redeem/route.ts:71-113`.
- `CARVERTICAL_REPORT` is not credit-unlockable: `/api/credits/redeem` rejects products whose `getCreditCost()` is null at `src/app/api/credits/redeem/route.ts:53-59`, and the Android UI states non-credit products are not sold in-app at `src/components/payment/PremiumLockedState.tsx:255-279`.
- Duplicate refunds use deterministic idempotency key `google-play-void:${notification.purchaseToken}` at `src/app/api/credits/google-play/notifications/route.ts:132-138`, backed by `CreditTransaction.idempotencyKey @unique` at `prisma/schema.prisma:625` and P2002 handling at `src/lib/credits/credit-wallet.ts:379-383`.
- Admin debt visibility exists:
  - `GET /api/admin/credits/wallets?negativeOnly=true` requires `requireAdmin()` at `src/app/api/admin/credits/wallets/route.ts:18-20` and filters `balance < 0` at `src/app/api/admin/credits/wallets/route.ts:22-30`.
  - `GET /api/admin/credits/wallets/[userId]/ledger` requires `requireAdmin()` at `src/app/api/admin/credits/wallets/[userId]/ledger/route.ts:13-15` and returns wallet plus transaction history at `src/app/api/admin/credits/wallets/[userId]/ledger/route.ts:22-58`.
  - `requireAdmin()` itself requires authentication and role `ADMIN` at `src/lib/admin/admin-guard.ts:16-26`, so normal authenticated users cannot access another user's wallet or ledger through these admin routes.

Ledger integrity:

- Grant: `balanceAfter = balanceBefore + amount` at `src/lib/credits/credit-wallet.ts:198-217`.
- Spend: `balanceAfter = balanceBefore - amount`, ledger `amount` is positive spend amount, at `src/lib/credits/credit-wallet.ts:279-300`.
- Refund/debt refund: `balanceAfter = balanceBefore - amount`, ledger `amount` is `-amount`, at `src/lib/credits/credit-wallet.ts:353-372`. In ledger arithmetic terms, `balanceBefore + transaction.amount = balanceAfter`.

Assumptions:

- The product decision "do not auto-revoke already generated reports" is intentional and remains accepted. The code implements that decision.
- No uninspected external job revokes Google Play refunded access. In the inspected app code, no Google Play refund path deletes or revokes completed reports.

## E. Regression Check

Verified facts:

- Android flow remains: Digital Goods / Payment Request API purchase returns a purchase token client-side (`src/lib/billing/google-play-client.ts:68-91`), the client sends `productId` and `purchaseToken` to `/api/credits/google-play/verify` (`src/store/useCreditStore.ts:57-75`, `src/services/api/credits.api.ts:44-50`), the server verifies with Google before granting credits (`src/app/api/credits/google-play/verify/route.ts:98-157`), credits are spent through `/api/credits/redeem` (`src/app/api/credits/redeem/route.ts:71-113`), and access is granted through `grantPremiumAccess()` (`src/lib/payments/premium-access.ts:31-57`).
- Credits are never granted solely from client claims. The client only obtains and submits a token (`src/lib/billing/google-play-client.ts:82-91`); the server calls Google `purchases.products.get` before granting (`src/lib/payments/google-play-verification.ts:57-91`, `src/app/api/credits/google-play/verify/route.ts:98-157`).
- Stripe web checkout remains a Stripe flow: `PaymentService` defaults to `StripeAdapter` at `src/modules/payments/payment.service.ts:22-25`, creates external checkout sessions at `src/modules/payments/payment.service.ts:84-103`, and the payment route calls that service at `src/app/api/payment/route.ts:38-43`.
- Stripe does not generate Android spendable credits. `grantPremiumAccess()` records Stripe only as an audit row with `amount: 0` through `recordExternalPurchaseAudit()` at `src/lib/payments/premium-access.ts:59-74`; `recordExternalPurchaseAudit()` never updates `CreditWallet.balance` and writes `amount: 0` at `src/lib/credits/credit-wallet.ts:409-427`.
- Android digital purchases still use Google Play Billing UI in the inspected Android/TWA branch: `PremiumLockedState` renders `GooglePlayCreditPurchase` for Android credit-unlockable products and not the Stripe button at `src/components/payment/PremiumLockedState.tsx:255-304`.
- CarVertical remains excluded from Android billing/redemption: Android non-credit products render a not-available message at `src/components/payment/PremiumLockedState.tsx:255-272`, and `/api/credits/redeem` rejects null credit cost at `src/app/api/credits/redeem/route.ts:53-59`.
- Google Play purchase history is user-scoped: `/api/credits/google-play/purchases` requires `requireAuth()` and filters `where: { userId: auth.userId }` at `src/app/api/credits/google-play/purchases/route.ts:20-29`.
- Service-account credentials are read only server-side from env in `src/lib/payments/google-play-auth.ts:14-49`. No `NEXT_PUBLIC_GOOGLE_PLAY...` references were found in `src`, `public`, or `prisma` by targeted search.

Assumptions:

- `isRunningInTwa()` correctly identifies the Android app context for UI branching. This re-audit did not expand into TWA detection correctness beyond the three scoped findings.

## F. Test / Type-check / Build Results

Commands run:

- `npm run type-check`
  - First run result: failed with TS6053 because `tsconfig.json:30` includes `.next/types/**/*.ts` and the referenced `.next/types/app/...` generated files were missing before build.
  - After `npm run build` regenerated `.next/types`, rerun result: passed with no TypeScript errors.
- `npm test`
  - Result: 1 failed suite, 19 passed suites, 20 total.
  - Test count: 376 passed, 376 total.
  - Failing suite: `tests/integration/payment.service.test.ts` failed to load because `STRIPE_SECRET_KEY environment variable is not set` is thrown by `src/modules/payments/providers/stripe/stripe.adapter.ts:24` during module import through `src/modules/payments/payment.service.ts:254`.
  - This matches the previously documented unrelated test-environment issue; no failing test assertion was reported.
  - Warnings/console output were not hidden. The test run also emitted expected mocked route/research console logs and warnings, including AI fallback warnings due to no API key in tests.
- `npm run build`
  - Result: passed.
  - Build compiled successfully, completed lint/type validation, generated 65 static pages, and listed the relevant dynamic routes including `/api/credits/google-play/verify`, `/api/credits/google-play/notifications`, `/api/credits/google-play/purchases`, `/api/credits/redeem`, `/api/admin/credits/wallets`, and `/api/admin/credits/wallets/[userId]/ledger`.
  - Build warnings: webpack pack cache snapshot warnings and Node `[DEP0005] Buffer()` deprecation warnings.

Expected baseline:

- The expected 376 passing tests were observed.
- The only test-suite failure is the same pre-existing Stripe test-environment import issue, not a failure in the three audited fixes.

## G. Remaining Critical Or High Issue Directly Related To These Three Fixes

High issue remains: RTDN voided-purchase verification is incomplete because pagination is not handled.

Evidence:

- `src/lib/payments/google-play-verification.ts:165-179` calls `purchases.voidedpurchases.list` once and returns that page only.
- `src/lib/payments/google-play-verification.ts:191-193` checks only that one returned array.
- Google's official `purchases.voidedpurchases.list` response includes `tokenPagination`; clients must follow page tokens to see more results when present. Source: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.voidedpurchases/list

Impact:

- Under high refund/void volume, a real refunded purchase can appear on a later page.
- The code can then return false from `wasPurchaseVoided()`, causing `handleVoidedPurchase()` to skip `refundCredits()` at `src/app/api/credits/google-play/notifications/route.ts:122-130`.
- This does not recreate the original fabricated-refund wallet-drain vector, but it leaves a high-severity accounting defect in the same RTDN security fix.

No other critical/high issue directly related to C1, C2, or H1 was found in this focused pass.

## H. Final Verdict

FIXES INCOMPLETE
