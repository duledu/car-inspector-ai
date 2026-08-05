// =============================================================================
// Google Play Developer API — authenticated client factory
//
// Builds an androidpublisher client from a service-account JSON credential.
// The credential is read from an env var only, never logged, never sent to
// the client bundle — every caller of this module lives under
// src/app/api/** or src/lib/payments/** (server-only).
// =============================================================================

import { google, androidpublisher_v3 } from 'googleapis'

let cachedClient: androidpublisher_v3.Androidpublisher | null = null

function loadServiceAccountCredentials(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON environment variable is not set')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON')
  }

  const creds = parsed as { client_email?: string; private_key?: string }
  if (!creds.client_email || !creds.private_key) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is missing client_email or private_key')
  }

  return { client_email: creds.client_email, private_key: creds.private_key }
}

/** The Android package name every verification call is scoped to. */
export function getPackageName(): string {
  return process.env.GOOGLE_PLAY_PACKAGE_NAME ?? 'com.usedcarsdoctor.app'
}

/** Returns a cached, authenticated androidpublisher v3 client. */
export function getAndroidPublisherClient(): androidpublisher_v3.Androidpublisher {
  if (cachedClient) return cachedClient

  const { client_email, private_key } = loadServiceAccountCredentials()
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })

  cachedClient = google.androidpublisher({ version: 'v3', auth })
  return cachedClient
}

/** Test-only: clears the cached client so credentials/mocks can be swapped between tests. */
export function resetAndroidPublisherClientCache(): void {
  cachedClient = null
}
