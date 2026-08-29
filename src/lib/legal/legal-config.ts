// =============================================================================
// Legal Configuration — single source of truth
//
// This is the ONE place that decides which legal-document versions are
// CURRENTLY required. Bumping any version here means every user (new or
// existing) must re-consent before using protected functionality again —
// see src/lib/legal/consent-guard.ts.
//
// OPERATOR IDENTITY — PLACEHOLDER, NOT FABRICATED:
// The actual contracting legal entity (registered company name, registration
// number, registered address, jurisdiction of incorporation) has not been
// provided and is NOT invented here. Every legal document currently
// identifies the operator only by the trade name "Used Cars Doctor". Once
// the real entity is available, fill in the fields below — nothing else in
// the legal/consent architecture needs to change to support that; the
// legal-document text reads these fields rather than hardcoding the name.
// =============================================================================

export const OPERATOR = {
  tradeName: 'Used Cars Doctor',
  /** TODO(legal): insert the actual registered legal entity name once available. */
  legalEntityName: null as string | null,
  /** TODO(legal): insert the company registration number once available. */
  registrationNumber: null as string | null,
  /** TODO(legal): insert the registered address once available. */
  registeredAddress: null as string | null,
  /** TODO(legal): insert the country/jurisdiction of incorporation once available. */
  incorporationJurisdiction: null as string | null,
  contactEmail: 'contact@usedcarsdoctor.com',
  website: 'https://usedcarsdoctor.com',
} as const

/**
 * The name to display in legal documents today. Falls back to the trade
 * name until a real legal entity is provided — never fabricates one.
 */
export function operatorDisplayName(): string {
  return OPERATOR.legalEntityName ?? OPERATOR.tradeName
}

// ─── Current required legal-document versions ────────────────────────────────
// Format is an ISO date (the date the version was published). Changing any
// of these three constants is what triggers re-consent — see
// tests/unit/legal-content-hash.test.ts, which fails loudly if section text
// changes without a version bump.

export const CURRENT_TERMS_VERSION = '2026-08-30'
export const CURRENT_PRIVACY_VERSION = '2026-08-30'
export const CURRENT_RISK_ACK_VERSION = '2026-08-30'

/**
 * Version of the one-time, client-side "before you start" inspection notice
 * (legal.riskAck.inspectionStart / Title / Continue) shown by AiConsentModal.
 * This gates a localStorage flag, NOT a server-recorded ConsentRecord — it
 * exists to force re-acknowledgement when that notice's wording changes,
 * independent of CURRENT_RISK_ACK_VERSION (which governs the signup-time
 * Risk Acknowledgement checkbox text and its server-side evidence record).
 * Bump this when the inspection-start notice copy changes materially.
 */
export const CURRENT_INSPECTION_START_ACK_VERSION = '2026-08-30'

export const LEGAL_EFFECTIVE_DATE = '2026-08-30'

/** Identifies which revision of the signup/consent UI presented the checkboxes — bumped when checkbox wording or layout changes materially, independent of the legal text itself. */
export const CONSENT_FORM_VERSION = '2026-08-30-v1'

/** Minimum age (in years) required to create an account or accept the Terms. */
export const MINIMUM_AGE = 18
