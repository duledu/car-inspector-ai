// =============================================================================
// Consent Guard — server-side authoritative enforcement
//
// Frontend gating (AppShell redirects) is UX only. This module is what
// actually decides whether a request may proceed — every protected
// inspection/report route calls hasCurrentConsent() or requireCurrentConsent()
// directly, so a client that skips the UI (a direct API call, a forged
// request) is rejected exactly the same way a browser would be.
//
// A fresh database read is used rather than trusting anything from the JWT —
// consent status can change (a user completes the consent gate) within the
// lifetime of a single 15-minute access token, and the check must reflect
// that immediately, not after the next token refresh.
// =============================================================================

import { prisma } from '@/config/prisma'
import { apiError } from '@/utils/api-response'
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, CURRENT_RISK_ACK_VERSION } from './legal-config'

export interface ConsentVersions {
  termsVersion: string
  privacyVersion: string
  riskAckVersion: string
}

export interface ConsentCheckResult {
  hasCurrentConsent: boolean
  latestRecord: {
    termsVersion: string
    privacyVersion: string
    riskAckVersion: string
    acceptedAt: Date
  } | null
}

/**
 * The single place that decides whether a set of accepted document versions
 * counts as "current". Pure and synchronous so it can be reused against
 * already-fetched rows (e.g. a bulk admin-reporting query) without either
 * re-deriving this comparison a second time or re-querying per user — see
 * src/app/api/admin/users/route.ts.
 */
export function isConsentCurrent(versions: ConsentVersions): boolean {
  return (
    versions.termsVersion === CURRENT_TERMS_VERSION &&
    versions.privacyVersion === CURRENT_PRIVACY_VERSION &&
    versions.riskAckVersion === CURRENT_RISK_ACK_VERSION
  )
}

/**
 * Reads the user's most recent ConsentRecord and compares it against the
 * currently required versions. A user with no record, or whose latest
 * record is for an older version of any of the three documents, does not
 * have current consent — a partial/stale match is not good enough.
 */
export async function hasCurrentConsent(userId: string): Promise<ConsentCheckResult> {
  const latest = await prisma.consentRecord.findFirst({
    where: { userId },
    orderBy: { acceptedAt: 'desc' },
    select: { termsVersion: true, privacyVersion: true, riskAckVersion: true, acceptedAt: true },
  })

  if (!latest) return { hasCurrentConsent: false, latestRecord: null }

  return { hasCurrentConsent: isConsentCurrent(latest), latestRecord: latest }
}

/**
 * Route-handler guard: returns a 403 CONSENT_REQUIRED response when the
 * authenticated user does not have current consent, otherwise null. Call at
 * the top of any protected handler, after requireAuth():
 *
 *   const consentBlock = await requireCurrentConsent(auth.userId)
 *   if (consentBlock) return consentBlock
 */
export async function requireCurrentConsent(userId: string) {
  const { hasCurrentConsent: ok } = await hasCurrentConsent(userId)
  if (ok) return null
  return apiError(
    'You must accept the current Terms of Use and risk acknowledgement before using this feature.',
    { status: 403, code: 'CONSENT_REQUIRED' },
  )
}
