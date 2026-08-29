// =============================================================================
// Legal Content Hash — server-only
//
// Deliberately kept out of legal-content-manifest.ts (which the Terms/
// Privacy client pages import for rendering) so that Node's `crypto` module
// never gets pulled into a client bundle. Used by the seed script and by
// tests/unit/legal-content-hash.test.ts, which pins the hash for the
// current version — editing section text without bumping the version
// changes the hash and breaks that test on purpose.
// =============================================================================

import crypto from 'crypto'
import en from '@/i18n/locales/en'
import { LEGAL_CONTENT_MANIFESTS } from './legal-content-manifest'

/**
 * Deterministic sha256 of a legal document's canonical (English) text, keyed
 * by its manifest. Missing keys throw rather than silently hashing
 * `undefined` — a manifest/locale drift must fail loudly, not produce a
 * quietly-wrong hash.
 */
export function computeLegalContentHash(documentType: 'TERMS' | 'PRIVACY' | 'RISK_ACKNOWLEDGEMENT'): string {
  const keys = LEGAL_CONTENT_MANIFESTS[documentType]
  const values = keys.map((key) => {
    const value = (en as Record<string, string>)[key]
    if (typeof value !== 'string') {
      throw new Error(`computeLegalContentHash: missing en.ts key "${key}" for document type ${documentType}`)
    }
    return value
  })
  const canonical = JSON.stringify(values)
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}
