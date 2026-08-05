# Google Play Release Checklist — Used Cars Doctor

Updated after implementing Google Play Billing (see `GOOGLE_PLAY_BILLING_SETUP.md`). Supersedes the billing-related items in the earlier `GOOGLE_PLAY_READINESS_AUDIT.md` — everything else in that audit (signing, store listing assets, permissions, Data Safety) is unaffected and still applies; it's referenced here rather than repeated.

## Billing — status after this change

- [x] Google Play Billing implemented for native AI products (`INSPECTION_REPORT`, `AI_DEEP_SCAN`, `FULL_INSPECTION_BUNDLE`) via the Digital Goods API + Payment Request API, server-verified against the Google Play Developer API.
- [x] CarVertical excluded from Android entirely — no Play Billing product, no Android purchase UI, no credit mapping. Stripe/web unaffected.
- [x] Credit wallet ledger (`CreditWallet`/`CreditTransaction`) reused as the sole Android purchase mechanism; append-only, idempotent per `purchaseToken` and per `idempotencyKey`.
- [x] Refund/chargeback handling via RTDN webhook.
- [ ] **Play Console products not yet created** — the 5 `inspection_credit_*` SKUs must be created in Play Console before any real purchase can succeed (§2 of the setup doc).
- [ ] **Service account not yet provisioned** — `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` must be generated and granted the right API access (§3).
- [ ] **RTDN Pub/Sub topic/subscription not yet created** — refunds will not be reflected in wallets until this exists (§6).
- [ ] **`bubblewrap update` + `bubblewrap build` not yet run** — this dev environment has no JDK; `twa-manifest.json` has the required flags set, but the Android project itself must be regenerated and rebuilt on a machine with Java + Android SDK (§9 of the setup doc).
- [ ] **App-resume purchase restore not wired up** — `listUnresolvedPurchases()` exists but nothing calls it automatically yet (§10, follow-up work).

## Carried over from the prior readiness audit (unchanged, still blocking)

Full detail in `GOOGLE_PLAY_READINESS_AUDIT.md`. Summary:

- [ ] **D1 — Unsigned build artifacts.** The only existing AAB/APK are unsigned. Must be signed with the existing `android.keystore` (path/alias already correct in `twa-manifest.json`) before any Play Console upload.
- [ ] **D3 — Missing store listing assets.** No feature graphic (1024×500), no phone screenshots.
- [ ] **E1 — `targetSdkVersion`.** Currently 35; Play requires API 36 for new apps/updates from 2026-08-31. Bump before submission.
- [ ] **E5 — Second `assetlinks.json` fingerprint.** Must be added after the first Play Console upload once the App Signing key fingerprint is known (also required for Play Billing's Digital Goods API to work at all — see setup doc §5).

## Play Console checklist (verified current as of this update)

- [ ] App access instructions (reviewer test account + how to reach a purchasable report)
- [ ] Ads declaration — no ad SDK in the codebase; declare "No ads"
- [ ] Content rating questionnaire
- [ ] Target audience & content
- [ ] Data Safety form — now also declare "financial info" / "purchase history" collection given Play Billing, in addition to the mappings in the prior audit
- [ ] Account deletion — already implemented in-app and via a public web page; link it in Play Console
- [ ] Privacy policy URL
- [ ] Financial features declaration — required, given both Stripe (web) and Play Billing (Android)
- [ ] App signing — enroll in Play App Signing on first upload
- [ ] Internal testing track — fastest path once a signed AAB exists; does not require the 12-tester/14-day closed test
- [ ] Closed testing (12 testers / 14 days) — only required if this is a **personal** developer account created after 2023-11-13; not required for organization accounts
- [ ] Production access application (3-section form, ~7 day review per Google's current guidance)

## Suggested order of operations

1. Get a JDK + Android SDK available (this repo's current dev environment lacks both).
2. Run `bubblewrap update` then `bubblewrap build`, sign with the existing keystore.
3. Create the 5 Play Console products, service account, and RTDN topic (`GOOGLE_PLAY_BILLING_SETUP.md`).
4. Set the 3 new env vars in production.
5. Upload the signed AAB to Internal Testing.
6. Add the Play App Signing fingerprint to `assetlinks.json`.
7. Test the full purchase → verify → redeem loop as a license tester (§8 of the setup doc).
8. Produce the feature graphic + screenshots, finish the Play Console checklist above.
9. Move to closed testing (if required) then production access.
