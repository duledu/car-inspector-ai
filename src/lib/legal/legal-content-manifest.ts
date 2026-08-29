// =============================================================================
// Legal Content Manifest — canonical key lists (client-safe, no Node builtins)
//
// Defines, for each legal document type, the exact ordered list of i18n keys
// that make up its legally operative text. Used both by the Terms/Privacy
// pages (to render every section in order) and by
// src/lib/legal/legal-content-hash.ts (server-only) to compute a stable
// content hash. Adding a new section means: add its title/body keys to
// en.ts + sr.ts, add both keys here, and bump the corresponding
// CURRENT_*_VERSION in legal-config.ts.
// =============================================================================

export const TERMS_CONTENT_KEYS: string[] = [
  'legal.terms.intro',
  'legal.terms.s1.title', 'legal.terms.s1.body',
  'legal.terms.s2.title', 'legal.terms.s2.body',
  'legal.terms.s3.title', 'legal.terms.s3.body',
  'legal.terms.s4.title', 'legal.terms.s4.body',
  'legal.terms.s5.title', 'legal.terms.s5.body',
  'legal.terms.s6.title', 'legal.terms.s6.body',
  'legal.terms.s7.title', 'legal.terms.s7.body',
  'legal.terms.s8.title', 'legal.terms.s8.body',
  'legal.terms.s9.title', 'legal.terms.s9.body',
  'legal.terms.s10.title', 'legal.terms.s10.body',
  'legal.terms.s11.title', 'legal.terms.s11.body',
  'legal.terms.s12.title', 'legal.terms.s12.body',
  'legal.terms.s13.title', 'legal.terms.s13.body',
  'legal.terms.s14.title', 'legal.terms.s14.body',
  'legal.terms.s15.title', 'legal.terms.s15.body',
  'legal.terms.s16.title', 'legal.terms.s16.body',
  'legal.terms.s17.title', 'legal.terms.s17.body',
  'legal.terms.s18.title', 'legal.terms.s18.body',
  'legal.terms.s19.title', 'legal.terms.s19.body',
  'legal.terms.s20.title', 'legal.terms.s20.body',
  'legal.terms.s21.title', 'legal.terms.s21.body',
  'legal.terms.s22.title', 'legal.terms.s22.body',
  'legal.terms.s23.title', 'legal.terms.s23.body',
  'legal.terms.s24.title', 'legal.terms.s24.body',
  'legal.terms.s25.title', 'legal.terms.s25.body',
  'legal.terms.s26.title', 'legal.terms.s26.body',
]

export const PRIVACY_CONTENT_KEYS: string[] = [
  'legal.privacy.s1.title', 'legal.privacy.s1.body',
  'legal.privacy.s2.title', 'legal.privacy.s2.body',
  'legal.privacy.s3.title', 'legal.privacy.s3.body',
  'legal.privacy.s4.title', 'legal.privacy.s4.body',
  'legal.privacy.s5.title', 'legal.privacy.s5.body',
  'legal.privacy.s6.title', 'legal.privacy.s6.body',
  'legal.privacy.s7.title', 'legal.privacy.s7.body',
  'legal.privacy.s8.title', 'legal.privacy.s8.body',
  'legal.privacy.s9.title', 'legal.privacy.s9.body',
  'legal.privacy.s10.title', 'legal.privacy.s10.body',
  'legal.privacy.s11.title', 'legal.privacy.s11.body',
  'legal.privacy.s12.title', 'legal.privacy.s12.body',
  'legal.privacy.s13.title', 'legal.privacy.s13.body',
]

export const RISK_ACK_CONTENT_KEYS: string[] = [
  'legal.riskAck.checkbox1',
  'legal.riskAck.checkbox2',
  'legal.riskAck.plainNotice',
  'legal.riskAck.inspectionStart',
]

export const LEGAL_CONTENT_MANIFESTS: Record<'TERMS' | 'PRIVACY' | 'RISK_ACKNOWLEDGEMENT', string[]> = {
  TERMS: TERMS_CONTENT_KEYS,
  PRIVACY: PRIVACY_CONTENT_KEYS,
  RISK_ACKNOWLEDGEMENT: RISK_ACK_CONTENT_KEYS,
}
