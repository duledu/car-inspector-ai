# Google Play Production-Readiness Audit — Used Cars Doctor

Audit date: 2026-08-04
Mode: Read-only inspection. No files modified, no keys regenerated, no destructive commands run.

---

## A. Executive Summary

Used Cars Doctor is a Next.js PWA wrapped in a Bubblewrap-generated Trusted Web Activity (TWA) for Android, package `com.usedcarsdoctor.app`. The web application itself is in good shape: the production build compiles cleanly, 313/313 runnable unit/integration tests pass, TypeScript is clean, cookie/session security is reasonable, and an account-deletion flow exists both in-app and as a public web page.

The Android/Play packaging is **not upload-ready**. Three independent blockers exist simultaneously:

1. The only AAB and APK build artifacts on disk are **unsigned** — Play Console will reject them outright.
2. **Google Play Billing is not implemented.** All payments (including for digital, in-app-consumed AI inspection reports/credits) go through Stripe web checkout. Google Play policy requires Play Billing for digital goods consumed inside the app — this is a payments-policy rejection risk, not a style preference.
3. **Store listing assets are incomplete** — no feature graphic, no phone screenshots found anywhere in the repo.

None of these require risky or destructive action to fix, but all three must be resolved before any Play Console upload (even to internal testing, for #1; before production, for #2 and #3).

## B. Overall Readiness Score: **38 / 100**

Scoring rationale: web app foundation and TWA/asset-link configuration are strong (would score ~80+ alone), but the score is capped low because upload is currently physically impossible (unsigned artifacts) and the core monetization path would violate Play policy if shipped as-is.

## C. Confirmed Production Configuration

| Item | Value | Source |
|---|---|---|
| App name | Used Cars Doctor | [twa-manifest.json:4](usedcarsdoctor-bubblewrap/twa-manifest.json#L4) |
| Launcher name | Cars Doctor | [twa-manifest.json:5](usedcarsdoctor-bubblewrap/twa-manifest.json#L5) |
| Package / Application ID | `com.usedcarsdoctor.app` | consistent in all 4 locations checked (see §C.1) |
| Host / production domain | `usedcarsdoctor.com` | [twa-manifest.json:3](usedcarsdoctor-bubblewrap/twa-manifest.json#L3) |
| Start URL | `/` (resolves to `https://usedcarsdoctor.com/`) | [twa-manifest.json:15](usedcarsdoctor-bubblewrap/twa-manifest.json#L15), [public/manifest.json:6](public/manifest.json#L6) |
| Scope | `/` | [public/manifest.json:7](public/manifest.json#L7) |
| Display mode | `standalone` (override: standalone, minimal-ui) | [twa-manifest.json:6](usedcarsdoctor-bubblewrap/twa-manifest.json#L6) |
| versionCode / versionName | 1 / 1.0.0 | [app/build.gradle:60-61](usedcarsdoctor-bubblewrap/app/build.gradle#L60-L61) |
| compileSdk / minSdk / targetSdk | 36 / 23 / 35 | [app/build.gradle:54,58,59](usedcarsdoctor-bubblewrap/app/build.gradle#L54) |
| Bubblewrap CLI | 1.24.1 | `npx @bubblewrap/cli --version` |
| Gradle wrapper | 8.11.1 | [gradle-wrapper.properties](usedcarsdoctor-bubblewrap/gradle/wrapper/gradle-wrapper.properties) |
| Android Gradle Plugin | 8.9.1 | [build.gradle:26](usedcarsdoctor-bubblewrap/build.gradle#L26) |
| Node.js (this machine) | v24.14.1 | `node --version` |
| Java/JDK | **Not found on PATH** in this environment (see §I) | `java -version` → command not found |

### C.1 Package ID consistency — CONFIRMED, no drift detected

| Location | Value | File |
|---|---|---|
| Bubblewrap manifest | `com.usedcarsdoctor.app` | [twa-manifest.json:2](usedcarsdoctor-bubblewrap/twa-manifest.json#L2) |
| Gradle `applicationId` | `com.usedcarsdoctor.app` | [app/build.gradle:24,57](usedcarsdoctor-bubblewrap/app/build.gradle#L57) |
| Gradle `namespace` | `com.usedcarsdoctor.app` | [app/build.gradle:55](usedcarsdoctor-bubblewrap/app/build.gradle#L55) |
| Local assetlinks.json | `com.usedcarsdoctor.app` | [usedcarsdoctor-bubblewrap/assetlinks.json:5](usedcarsdoctor-bubblewrap/assetlinks.json#L5) |
| **Live** assetlinks.json | `com.usedcarsdoctor.app` | fetched from `https://usedcarsdoctor.com/.well-known/assetlinks.json` |

No temporary/placeholder package ID (e.g. `com.example.*`) found anywhere. **No mismatch.**

Not applicable / not found: no native Firebase SDK, no native Google Sign-In Android SDK, and no Android-specific OAuth client are used — Google login runs through the standard web OAuth flow inside the TWA's browser context, so there is no Android-package-scoped OAuth client to cross-check. `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` exist as env var **names** (values not read/printed) in `.env.production.local`.

---

## D. Critical Blockers — must fix before upload

### D1. Both existing Android build artifacts are unsigned
- **Severity:** Critical
- **Evidence:** `usedcarsdoctor-bubblewrap/app/build/outputs/bundle/release/app-release.aab` (1,774,804 bytes, dated 2026-04-16) and `usedcarsdoctor-bubblewrap/app-release-unsigned-aligned.apk` (filename says it, and confirmed: neither archive contains a top-level `META-INF/MANIFEST.MF` or `META-INF/*.RSA`/`*.SF` signing block — checked via `unzip -l`).
- **Why it matters:** Play Console rejects unsigned AAB/APK uploads unconditionally, at every track including internal testing.
- **Recommended solution:** With your approval, sign the existing AAB using the existing `android.keystore` (path/alias already correctly wired in `twa-manifest.json:20-23`) via `bubblewrap build` (regenerates + signs) or `jarsigner`/`apksigner` directly against the existing bundle. Requires the keystore password, which I do not have and did not ask for. **I did not attempt this** — no Java/JDK was found on this machine's PATH either (see §I), so no build tool could run in this session regardless.
- **Risk if ignored:** Cannot upload to any Play Console track.

### D2. Google Play Billing is not implemented — Stripe-only checkout for digital goods
- **Severity:** Critical (policy)
- **Evidence:** [src/modules/payments/payment.service.ts](src/modules/payments/payment.service.ts) and [src/app/api/payment/route.ts](src/app/api/payment/route.ts) create a Stripe Checkout session and redirect the user to it for `INSPECTION_REPORT`, `AI_DEEP_SCAN`, `CARVERTICAL_REPORT`, `FULL_INSPECTION_BUNDLE`. A parallel "credit wallet" foundation exists ([src/lib/credits/credit-wallet.ts](src/lib/credits/credit-wallet.ts), [src/lib/payments/google-play-verification.ts](src/lib/payments/google-play-verification.ts)) but every verification function explicitly `throw`s `NOT_IMPLEMENTED` ([google-play-verification.ts:84-124](src/lib/payments/google-play-verification.ts#L84-L124)) and there is no route that accepts an Android purchase token — this is scaffolding, not a working integration. The only way to add credits today is `POST /api/credits/grant-test`, which is admin-only and disabled in production ([grant-test/route.ts:20](src/app/api/credits/grant-test/route.ts#L20)).
- **Why it matters:** Google Play policy requires Google Play Billing for digital goods purchased and consumed inside an Android app (confirmed via current Play Console Payments policy documentation, see §N sources). AI inspection reports/credits are digital goods consumed entirely in-app. Shipping Stripe as the only path is a Payments-policy violation and a near-certain rejection or later suspension.
- **Recommended solution:** Before production release (internal/closed testing can proceed without this, since testers aren't the policy trigger — production listing is), implement the Play Billing path: client-side Digital Goods API / Payment Request API purchase inside the TWA (Chrome supports this for TWAs), plus the already-stubbed server-side verification via the Google Play Developer API (service account, `androidpublisher` API) — the stub file even documents the exact implementation steps. Do not ship the Stripe flow to the Android build for these product types, or gate it so Android users only see the Play Billing path.
- **Risk if ignored:** Play Console rejection at review, or app suspension after publish if discovered later (has happened to real published apps).

### D3. Store listing assets are missing
- **Severity:** Critical (blocks store listing creation, not code)
- **Evidence:** Searched `public/` and the whole repo for a Play feature graphic (1024×500) and phone screenshots — none found. Present: app icon 1024×1024 (`public/app-icon.png`), `icon-512.png` (512×512, confirmed via PNG header), `icon-192.png` (192×192). `public/manifest.json:40` has `"screenshots": []` (empty).
- **Why it matters:** Play Console requires a feature graphic and at least 2 phone screenshots to publish any listing, even to closed testing tracks in some flows.
- **Recommended solution:** Produce a 1024×500 feature graphic and 2–8 real phone screenshots (from the actual running app, not mockups) before creating the store listing.
- **Risk if ignored:** Cannot complete the Play Console store listing at all.

---

## E. High-Priority Issues — must fix before production release

### E1. `targetSdkVersion` will fall below Play's requirement for new apps within weeks
- **Severity:** High
- **Evidence:** `targetSdkVersion 35` at [app/build.gradle:59](usedcarsdoctor-bubblewrap/app/build.gradle#L59); `compileSdkVersion` is already 36.
- **Why it matters:** Per current Play Console policy (verified via web search, see §N), **new apps and app updates must target Android 16 (API 36) starting August 31, 2026**. Today is 2026-08-04. If review/upload takes any real time, this app will land right on top of that deadline.
- **Recommended solution:** Bump `targetSdkVersion` to 36 (compileSdk is already there) and re-test before submission.
- **Risk if ignored:** Submission rejected or blocked right around the deadline, forcing a rebuild under time pressure.

### E2. No login rate limiting / brute-force protection
- **Severity:** High
- **Evidence:** [src/app/api/auth/[action]/route.ts:184-224](src/app/api/auth/%5Baction%5D/route.ts#L184-L224) `handleLogin` — no attempt counter, no lockout, no delay. Rate limiting exists elsewhere (`analyze-photo` route) but not on `/api/auth/login`.
- **Why it matters:** Credential-stuffing / brute-force risk against user accounts; not a Play Store blocker by itself but a real security gap given this is about to get much wider distribution via Play Store.
- **Recommended solution:** Add per-IP/per-account rate limiting (e.g. sliding window in Redis/DB) to the login and password-reset-request handlers.
- **Risk if ignored:** Account takeover risk scales with install base.

### E3. Android project (`usedcarsdoctor-bubblewrap/`) is entirely git-ignored
- **Severity:** High
- **Evidence:** [.gitignore:34](.gitignore#L34) `usedcarsdoctor-bubblewrap/` — the whole directory, including `twa-manifest.json`, `build.gradle`, `gradle.properties`, `assetlinks.json`, is untracked. Confirmed via `git log --all -- usedcarsdoctor-bubblewrap` showing only two historical commits that *removed* an accidentally-committed `twa-manifest.json`.
- **Why it matters:** If this machine is lost, the entire Android project (not just the keystore) has no backup or version history. Regenerating it from scratch with Bubblewrap is possible but error-prone (you'd need to remember every non-default setting: shortcuts, colors, min SDK, fingerprints).
- **Recommended solution:** At minimum, back up `usedcarsdoctor-bubblewrap/twa-manifest.json`, `build.gradle`, `app/build.gradle`, and `assetlinks.json` somewhere durable (they contain no secrets — the keystore path/alias only, not the password). Consider tracking the non-generated config files in git while keeping `.gradle/`, `build/`, and the keystore itself ignored.
- **Risk if ignored:** Full loss of Android packaging config on machine failure; keystore loss separately would be catastrophic (see F).

### E4. `android.keystore` has a single backup copy, no documented recovery plan
- **Severity:** High
- **Evidence:** `android.keystore` exists only at repo root, correctly excluded from git via [.gitignore:42](.gitignore#L42) (`*.keystore` and explicit `android.keystore` entry). Confirmed via `git log --all -- android.keystore` → no commits, never tracked.
- **Why it matters:** If this is an **upload key** (see §I), losing it means requesting Google to reset your upload key via Play Console's key-reset flow (extra friction, days of delay). If Play App Signing is not yet enrolled and this is used as the actual signing key with no App Signing enrollment, losing it is unrecoverable — you'd have to publish a new app listing under a new package ID.
- **Recommended solution:** Back up `android.keystore` (encrypted) to at least one location off this machine, and enroll in Play App Signing on first upload so Google holds the durable copy of the app signing key going forward.
- **Risk if ignored:** Permanent inability to publish updates to this app if the keystore is lost.

### E5. Digital Asset Links will need a second fingerprint after first Play upload
- **Severity:** High (time-bound — becomes real only after first upload)
- **Evidence:** `assetlinks.json` (local and live, byte-for-byte identical) lists exactly one `sha256_cert_fingerprints` value, matching `twa-manifest.json`'s recorded fingerprint for `android.keystore` (`41:B4:2C:76:...`). See §H for full detail.
- **Why it matters:** If Play App Signing is enabled (Google's default for new apps), Google re-signs the distributed APK/AAB with its own certificate. Users who install from Play Store will present a **different** SHA-256 fingerprint than the one currently in `assetlinks.json`. Digital Asset Links verification will fail for those installs, and the TWA will fall back to showing the Chrome Custom Tabs address bar instead of a fullscreen app.
- **Recommended solution:** After the first Play Console upload, copy the "App signing key certificate" SHA-256 from Play Console → Setup → App integrity, and add it as a second entry in `sha256_cert_fingerprints` in the production `assetlinks.json` served at `/.well-known/assetlinks.json`, alongside the existing upload-key fingerprint.
- **Risk if ignored:** App opens with a visible browser address bar for every Play Store-installed user — breaks the entire point of shipping a TWA.

---

## F. Medium-Priority Improvements

| # | Issue | Evidence | Recommendation |
|---|---|---|---|
| F1 | `next lint` has never been configured in this repo (interactive first-run prompt appears) | `npm run lint` output stopped at "How would you like to configure ESLint?" | Run `next lint` once interactively and commit the resulting `.eslintrc`, so lint is enforceable in CI |
| F2 | One test suite fails only due to a missing `STRIPE_SECRET_KEY` in the test environment, not a code defect | `tests/integration/payment.service.test.ts` → "STRIPE_SECRET_KEY environment variable is not set" | Provide a dummy test-mode Stripe key in the test env, or mock `StripeAdapter` construction in that suite |
| F3 | `public/manifest.json` has an empty `screenshots` array | [public/manifest.json:40](public/manifest.json#L40) | Add PWA screenshots — improves the native "install app" richer prompt on Android/desktop Chrome, separate from the Play Store listing screenshots in D3 |
| F4 | No `public/robots.txt` found | `Glob public/robots.txt` → no matches | Low priority; add one if SEO of `/legal/*`, `/admin-panel` crawl exposure matters |
| F5 | `.env.production.local` exists in the working tree (git-ignored, confirmed) | file listing at repo root | Not a code defect since it's ignored — just confirm it isn't being synced anywhere outside this machine (e.g. cloud-synced folder) |

---

## G. Bubblewrap / TWA Verification Results

- **twa-manifest.json** located at [usedcarsdoctor-bubblewrap/twa-manifest.json](usedcarsdoctor-bubblewrap/twa-manifest.json) — fully populated, no placeholder values.
- **Versions:** Bubblewrap CLI 1.24.1 (current major; ran `npx @bubblewrap/cli --version` successfully). Gradle 8.11.1, AGP 8.9.1, compileSdk 36 — all current/modern as of Aug 2026, no obvious staleness. Project does **not** appear to need a `bubblewrap update` regeneration based on config alone.
- **Config confirmed:**
  - host: `usedcarsdoctor.com`, startUrl: `/`, fullScopeUrl: `https://usedcarsdoctor.com/`
  - display: `standalone`, displayOverride: `[standalone, minimal-ui]`
  - orientation: `portrait-primary`
  - themeColor/themeColorDark: `#080c14`, navigationColor/Dark: `#000000`
  - launcher icon: `https://usedcarsdoctor.com/icons/icon-512.png`; maskable: `.../maskable-icon-512.png`; monochrome: `.../icon-192.png`
  - splash screen: background `#080c14`, fade-out 300ms, wired via `SPLASH_IMAGE_DRAWABLE` / `SPLASH_SCREEN_BACKGROUND_COLOR` in [AndroidManifest.xml:108-112](usedcarsdoctor-bubblewrap/app/src/main/AndroidManifest.xml#L108-L112)
  - notification delegation: **disabled** (`enableNotifications: false`) — the `DelegationService` exists in the manifest but is conditionally enabled/exported only when this flag is true, so it's currently inert. Intentional-looking, not a bug.
  - fallback behavior: `customtabs` (falls back to Chrome Custom Tabs, not an in-app WebView, if TWA isn't supported)
- **Verified TWA vs browser toolbar:** Cannot be tested on-device in this environment, but the prerequisite (`assetlinks.json` reachable, valid, matching fingerprint) is satisfied today for the **upload-key** fingerprint (see §H). It will only render as a fullscreen verified TWA for Play-Store-installed users once the Play App Signing fingerprint is also added (see E5) — until then, sideloaded builds signed with `android.keystore` directly would verify fine, but the eventual Play Store release will not.
- **Common Bubblewrap mistakes checked, none found:** package ID matches everywhere; `webManifestUrl` points to the real production manifest; `iconUrl`/`maskableIconUrl` are absolute HTTPS URLs, not relative paths; `minSdkVersion` (23) is below `targetSdkVersion`; no leftover `com.example` scaffolding.

## H. Digital Asset Links Results

| Check | Result |
|---|---|
| Local `assetlinks.json` valid JSON | ✅ |
| Live `https://usedcarsdoctor.com/.well-known/assetlinks.json` reachable over HTTPS | ✅ (fetched successfully) |
| Live content matches local file byte-for-byte | ✅ |
| `relation` includes `delegate_permission/common.handle_all_urls` | ✅ (this is the correct/current relation string — `handle_all_urls` is the identifier, not a separate `handle_all_urls` relation as sometimes mis-typed) |
| `package_name` correct | ✅ `com.usedcarsdoctor.app` |
| `sha256_cert_fingerprints` present and non-empty | ✅ one entry: `41:B4:2C:76:BD:69:A1:C5:79:56:97:9C:70:8F:1B:AC:7E:C8:4B:13:0E:A1:AC:66:CA:DF:15:F7:28:7F:9E:63` |
| Redirects / content-type | Not independently verifiable with the tooling available in this session (WebFetch does not expose raw response headers) — recommend a manual `curl -I` check that the URL returns `200` directly (no redirect) with `Content-Type: application/json` |

**Which fingerprint is which:**
- The single fingerprint currently present is the **upload key** fingerprint — it's the one recorded by Bubblewrap in `twa-manifest.json:56-60` at keystore-generation time for `android.keystore` (alias `android`), and it's the key that would sign the AAB you upload to Play Console.
- The **Play App Signing key** fingerprint does not exist yet — Google only generates it the first time you upload a release and opt into (or are defaulted into) Play App Signing. It is a *different* certificate that Google controls, used to actually sign what end users download.

**What would cause TWA verification to fail after Play Store install:** exactly the scenario in E5 — once Play re-signs the app with its own key, the fingerprint Android checks against `assetlinks.json` won't be in the file until you add it there too. Until that's done, Play-Store-installed copies show a Chrome address bar instead of launching fullscreen.

## I. Signing and AAB Results

- **Keystore file:** `android.keystore` at repo root (confirmed present, 2,714 bytes).
- **Format:** Confirmed via `openssl pkcs12 -info` to be a valid PKCS12 container (correct modern `keytool` default format). No password was supplied or guessed.
- **Alias:** `android` (read from `twa-manifest.json:22`, not a secret).
- **Certificate SHA-256 fingerprint:** Could not be independently extracted in this session — no `keytool`, `openssl x509`-compatible extraction (needs the store password), `jarsigner`, `apksigner`, or `bundletool` were found on this machine's PATH, and no JDK installation was found either (checked common locations: Android Studio's bundled JBR, Program Files\Java, Eclipse Adoptium — none present; the only similarly-named app found, "bstudio," is Bootstrap Studio, an unrelated design tool). The fingerprint recorded by Bubblewrap for this exact keystore/alias at generation time is `41:B4:2C:76:BD:69:A1:C5:79:56:97:9C:70:8F:1B:AC:7E:C8:4B:13:0E:A1:AC:66:CA:DF:15:F7:28:7F:9E:63` (from `twa-manifest.json:56-60`), and it matches what's published live in `assetlinks.json` — strong indirect evidence it's correct, but not independently re-derived from the keystore file itself.
- **Certificate expiry:** Could not be determined without `keytool`/`openssl x509` access to the certificate (blocked by the same tooling gap, and I did not attempt password entry).
- **Passwords:** Not printed, not requested, not present in any file I read.
- **Upload key vs App Signing key:** This is an **upload key** (Bubblewrap-generated local keystore used to sign what you send *to* Google) — see §H for the distinction. No App Signing key exists yet because no app has been uploaded to Play Console yet.
- **Git exposure check:** `android.keystore` has **never** been committed (`git log --all -- android.keystore` returns nothing) and is correctly listed in `.gitignore` twice (`*.keystore` glob and the explicit filename). One historical commit (`6ea7df1`, "Remove accidental Bubblewrap artifacts and harden gitignore") did briefly commit-then-remove an earlier `twa-manifest.json` — but that file only ever contained the keystore's local file *path* and alias, never a password or the keystore itself. **No secret was ever exposed in git history.**
- **Can the project currently produce a signed release AAB?** Not in this session — blocked by the missing JDK/build tools described above. The project structure to do so (signing config wired to `android.keystore`, correct alias) is present and looks correct once Java/Gradle are available.
- **Existing build artifacts:**
  | File | Size | Signed? |
  |---|---|---|
  | `usedcarsdoctor-bubblewrap/app/build/outputs/bundle/release/app-release.aab` | 1,774,804 bytes (~1.73 MB) | ❌ No signing block found |
  | `usedcarsdoctor-bubblewrap/app-release-unsigned-aligned.apk` | 1,646,614 bytes (~1.65 MB) | ❌ No (filename confirms; verified no `META-INF/CERT.*`) |

  Per your instructions, **I did not overwrite, sign, or otherwise touch either artifact.**
- **Version/SDK metadata of the existing (unsigned) AAB, from the build config that produced it:** package `com.usedcarsdoctor.app`, versionCode 1, versionName 1.0.0, minSdk 23, targetSdk 35, compileSdk 36 (all from `app/build.gradle`, consistent with what's embedded in the bundle's `BundleConfig.pb`).
- **Debug/test flags check (via `unzip -l` structural inspection, since `bundletool`/`aapt` were unavailable to decode the binary manifest):**
  - No `android:debuggable="true"` attribute found in any of the four intermediate merged manifests under `app/build/intermediates/`.
  - No `usesCleartextTraffic` override found (defaults to disallowed on targetSdk 28+, i.e. HTTPS-only).
  - No test/localhost endpoints are baked into the Android build itself — the TWA has no native code of its own; it only points Chrome at `https://usedcarsdoctor.com`, so "what URL does it load" is entirely controlled server-side by the Next.js app's own env config, not by anything in the AAB.
  - No source maps or embedded secrets found in the bundle's `base/root/` asset listing — it's standard AndroidX/androidbrowserhelper library boilerplate plus app resources.

## J. Google Play Billing Results

- **Implemented today:** Stripe Checkout only, for all four product types (`CARVERTICAL_REPORT`, `AI_DEEP_SCAN`, `FULL_INSPECTION_BUNDLE`, `INSPECTION_REPORT`) — see [payment.service.ts](src/modules/payments/payment.service.ts) and [payment/route.ts](src/app/api/payment/route.ts). This is a one-time-payment web checkout, not a subscription.
- **Google Play Billing:** Scaffolded but **not implemented**. Present: a credit-wallet ledger ([credit-wallet.ts](src/lib/credits/credit-wallet.ts)) with solid idempotency/negative-balance/duplicate-token guards already built in, and a product-ID map ([google-play-products.ts](src/lib/payments/google-play-products.ts): `inspection_credit_1` through `_5`). **Not present:** the actual Google Play Developer API verification call — every function in [google-play-verification.ts](src/lib/payments/google-play-verification.ts) throws `NOT_IMPLEMENTED` by design, there's no client-side Digital Goods API / Payment Request API integration, and there's no public route that accepts a purchase token from an Android client.
- **Purchase acknowledgement / consumption / refund handling for Play Billing:** Not implemented (would need the Phase 2 work described in the stub file's own comments).
- **Product IDs:** Defined (`inspection_credit_1..5`) but not yet created in Play Console (can't be, since no app exists there yet).
- **Restore/reconciliation, pending purchases, duplicate handling:** The wallet ledger's `idempotencyKey` + unique `purchaseToken` design (per its own doc comment) is built to prevent double-granting — good foundation — but it's unexercised by any real purchase flow yet.
- **Stripe/TWA policy conflict:** Confirmed. Google Play's Payments policy requires Play Billing for digital goods purchased and consumed in-app. AI inspection credits/reports are exactly that. Shipping the current Stripe-only flow to Android users is a policy risk (see D2).
- **What is genuinely still required (not invented, stated plainly):** (1) client-side purchase flow using the Digital Goods API/Payment Request API inside the TWA, (2) server-side purchase-token verification via `androidpublisher` API with a Google service account, (3) acknowledgement within 3 days, (4) consumption for repeatable purchases, (5) wiring the existing credit-wallet ledger to that verified flow instead of only to the admin test-grant endpoint.

## K. Privacy / Data Safety Mapping

| Data type | Collected? | Evidence | Notes |
|---|---|---|---|
| Email | Yes | `User.email`, login/register flow | Used for account identity + auth |
| Account info (name, password hash, role, language, country, currency) | Yes | `prisma/schema.prisma` User model (via `bcrypt.hash`, `preferredLanguage`, `countryCode`) | Password stored as bcrypt hash, not plaintext |
| Uploaded vehicle photographs | Yes | [analyze-photo/route.ts](src/app/api/inspection/analyze-photo/route.ts) accepts `imageBase64`, sends to OpenAI Vision (gpt-4o) | Sent to a third-party AI provider — see below |
| AI prompts/results | Yes | Same route; structured findings stored per vehicle | |
| Payment/purchase data | Yes | `PremiumPurchase`, `PaymentEvent`, `AccessGrant` tables; Stripe as processor | Stripe holds card data, not this app |
| Analytics | Not found | No analytics SDK (GA, Mixpanel, etc.) found in a targeted search of `src/` | If added later, must be declared |
| Device information | Not found | No device-fingerprinting code found | |
| Crash logs | Not found in the web app | No Sentry/Crashlytics found | The Android TWA shell itself doesn't add native crash reporting (Bubblewrap default has none) |
| Advertising identifiers | Not found | No ad SDK found | Matches "no ads" expectation for a paid-utility app |

**Third-party AI disclosure:** Found in-app consent copy: *"This app uses AI to analyze vehicle images. Results may be inaccurate or incomplete. Images may be processed by third-party AI services."* ([en.ts:310](src/i18n/locales/en.ts#L310)). This confirms the disclosure exists in the product. I did not find the equivalent explicit "OpenAI" naming inside the `/legal/privacy` page's own copy in the time available — recommend a manual read-through of that page to confirm it names the AI sub-processor and matches what you'll declare in Play Console's Data Safety form (which asks specifically whether data is shared with third parties and for what purpose).

**Account deletion:** ✅ Present both in-app (`DeleteAccountTrigger.tsx`, referenced from `src/app/profile/page.tsx`) and as a public, no-login-required web page ([src/app/legal/account-deletion/page.tsx](src/app/legal/account-deletion/page.tsx)) — this satisfies Play's account-deletion requirement (in-app deletion **and** a web path that doesn't require reinstalling the app).

**Retention of uploaded images/reports:** Not fully traced in this pass — I confirmed images are received and processed but did not trace a deletion/retention job. Recommend confirming (a) whether raw uploaded photos are stored beyond the analysis request/response cycle, and (b) whether deleting an account or a vehicle also purges associated photos and AI report data, before answering Play's Data Safety retention questions.

**Privacy policy publicly accessible:** `/legal/privacy` exists as a real Next.js route and was included in the successful production build output (`○ /legal/privacy 7.29 kB`) — publicly reachable once deployed, not gated behind auth.

## L. Android Permissions

The final packaged release manifest (`app/build/intermediates/packaged_manifests/release/processReleaseManifestForPackage/AndroidManifest.xml`) declares exactly:

| Permission | Why it's there | Sensitive? |
|---|---|---|
| `com.usedcarsdoctor.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | Self-defined signature permission, auto-generated by AndroidX for a dynamically-registered broadcast receiver | No — standard AndroidX boilerplate, not user-facing |

**No `INTERNET` permission is declared**, and that's correct, not a bug: a TWA doesn't make network requests itself — Chrome does, in its own process, using its own permission. **No camera, storage/media, location, notifications, or advertising-ID permission is requested.** Photo capture/upload happens through the web page's standard HTML file input, which triggers the system camera/gallery picker inside Chrome without needing a manifest-declared Android permission.

**Photo/video access requirements (Android 13+ granular media permissions):** Not applicable here — since no native storage/media permission is requested at all, the current Android 13+ `READ_MEDIA_IMAGES` / partial-access requirements don't come into play for this TWA.

**Misleading-claims check:** The AI consent copy already includes an appropriate disclaimer ("Results may be inaccurate or incomplete") — good practice for Play's policy on apps making assessments users might rely on for purchase decisions. I did not do a full sweep of every inspection-report string for absolute/guarantee-style language (e.g. "guaranteed no issues") — worth a dedicated copy review before launch given this is a vehicle-condition assessment product, which sits close to Play's misleading-claims scrutiny for anything resembling a safety or financial guarantee.

## M. Store Listing Requirements

| Asset | Status | Evidence |
|---|---|---|
| App title | Available | "Used Cars Doctor" |
| Short/full description | Not found in repo | No store-listing copy found in `docs/` or elsewhere — likely needs to be written fresh for Play Console |
| App icon | ✅ Available | `public/app-icon.png` (1024×1024), plus a dedicated `usedcarsdoctor-bubblewrap/store_icon.png` (512×512) |
| Feature graphic (1024×500) | ❌ Missing | not found anywhere in repo |
| Phone screenshots | ❌ Missing | not found anywhere in repo |
| Tablet screenshots | ❌ Missing (only required if you declare tablet support) | |
| Privacy policy URL | ✅ Available once deployed | `https://usedcarsdoctor.com/legal/privacy` |
| Support email | Not confirmed | not found in a targeted search — recommend confirming what address you intend to list |
| Support website | Available | `https://usedcarsdoctor.com` |

## N. Play Console Release Requirements Checklist

Verified against current (2026) Play Console documentation via web search rather than relying on older assumptions.

- [ ] **App access instructions** — needed if any part of the app requires login to review (it does); prepare a test account + instructions for reviewers.
- [ ] **Ads declaration** — no ad SDK found in the codebase; declare "No ads."
- [ ] **Content rating questionnaire** — not yet completed (external to this repo).
- [ ] **Target audience & content** — not yet set (external to Play Console).
- [ ] **Data Safety form** — draft mapping provided in §K; must be completed to match actual behavior.
- [ ] **Account deletion** — code-side requirement is met (§K); still must be linked/declared in Play Console's Data Safety section.
- [ ] **Privacy policy** — page exists and will be reachable once deployed; must be linked in Play Console.
- [ ] **Financial features declaration** — likely required given payment/checkout functionality; confirm during Play Console setup.
- [ ] **Health apps declaration** — not applicable (vehicle inspection, not health).
- [ ] **Government/news/family declarations** — not applicable.
- [ ] **App signing** — cannot proceed until D1 is resolved; recommend enrolling in Play App Signing on first upload (see H/E5).
- [ ] **Internal testing** — technically the fastest track once a signed AAB exists; does not require the 12-tester/14-day closed test.
- [ ] **Closed testing requirement for new personal developer accounts** — confirmed current as of 2026: if this is a **personal** Google Play developer account created after **November 13, 2023**, you must run a closed test with **12 opted-in testers for 14 consecutive days** before production access is available. This does not apply to organization/company developer accounts. ("Opted-in" means the tester accepted the invite and installed under the matching Google account — invited-but-not-installed doesn't count.) *I don't know which type of developer account you have — this is a question for you, not something derivable from the repo.*
- [ ] **Production access** — granted via a 3-section application after the closed test; Google states review is typically ≤7 days.

**What can only be completed after phone verification / Play Console account setup (outside this repo entirely):** developer account phone/identity verification itself, content rating questionnaire, Data Safety form submission, ads declaration, target audience selection, and the closed-testing tester roster — none of these exist in code and all require the Play Console UI directly.

## O. Exact Commands Executed and Their Results

| Command | Result |
|---|---|
| `git check-ignore -v android.keystore` | Ignored via `.gitignore:42` |
| `git log --all --oneline -- android.keystore` | No output — never committed |
| `git log --all --oneline -- usedcarsdoctor-bubblewrap` | 2 commits, both about *removing* accidentally-committed files, no secrets found in the diff |
| `node --version` | v24.14.1 |
| `java -version` (Bash and PowerShell) | Command not found in both shells |
| `npx @bubblewrap/cli --version` | 1.24.1 |
| `unzip -l` on the AAB and APK | No `META-INF/MANIFEST.MF` / `CERT.*` in either — confirms unsigned |
| `openssl pkcs12 -info -in android.keystore` | Confirms valid PKCS12 structure; correctly did not supply a real password |
| `npm run type-check` (`tsc --noEmit`) | ✅ Clean, no errors |
| `npm run lint` (`next lint`) | Stopped at first-run interactive ESLint setup prompt — not yet configured in this repo |
| `npm test` (`jest`) | 313/313 tests passed; 1 suite failed to *load* due to a missing `STRIPE_SECRET_KEY` test-env var (environment issue, not a code defect) |
| `npm run build` (`next build`) | ✅ Compiled successfully, 60 static pages generated, all routes listed cleanly |
| WebFetch `https://usedcarsdoctor.com/.well-known/assetlinks.json` | Live content fetched, matches local file exactly |
| Web search: Play Console closed-testing requirements 2026 | 12 testers / 14 days for personal accounts created after 2023-11-13 |
| Web search: Play target API level 2026 | New apps/updates must target API 36 (Android 16) from 2026-08-31 |
| Web search: Play Billing policy for digital goods in TWAs | Play Billing required for in-app digital goods; TWA over a real PWA is Google's recommended packaging approach |

## P. Recommended Next Actions, in Strict Order

1. **Decide and confirm your Play Console developer account type** (personal vs. organization) — determines whether the 12-tester/14-day closed test gate applies. *(Needs your input — not derivable from the repo.)*
2. **Get a JDK + Android SDK available in a build environment** (this session's shell has neither) so the existing signing config can actually be exercised.
3. **Sign the existing AAB** with `android.keystore` (with your explicit go-ahead and the keystore password, which I don't have) — resolves D1.
4. **Bump `targetSdkVersion` to 36** in `app/build.gradle` before the Aug 31, 2026 enforcement date — resolves E1.
5. **Decide the Google Play Billing implementation plan** for AI credits/reports (D2/§J) — this is the largest remaining engineering item and should be scoped before you invest in store listing polish.
6. **Produce the feature graphic and phone screenshots** — resolves D3/M.
7. **Upload the signed AAB to Internal Testing** in Play Console once #3 is done — this track doesn't require Play Billing or the closed-testing gate, and lets you validate the real TWA/asset-link handshake end-to-end on a device.
8. **After that first upload**, retrieve the Play App Signing certificate fingerprint and add it to `assetlinks.json` alongside the existing one — resolves E5/H.
9. **Add login rate limiting** — resolves E2.
10. **Back up `android.keystore` and the Android project config files** somewhere durable — resolves E3/E4.
11. Only once #5 has a real implementation and #6 is done, move toward the 12-tester/14-day closed test (if applicable) and then production access.

---

## Verdict: **NOT READY**

The web application is genuinely close to solid, but the Android/Play packaging has three independent, unrelated blockers (unsigned artifacts, no Play Billing for digital goods, missing store assets) that each individually prevent upload or production release. None require destructive or high-risk action to fix — they're additive engineering and asset-production work. Recommend working through §P in order, starting with items 1–4, and returning for a follow-up audit once a signed internal-testing build is on a device.
