// =============================================================================
// i18n Locale Parity — Regression Guard
//
// Missing keys in de/mk/sq/bg silently fall back to English (fallbackLng in
// i18n/config.ts) rather than crashing, which is exactly what let 359-449
// keys go untranslated for months without any test catching it (2026-08-31
// audit). This test enforces full key coverage going forward, with one
// deliberate exception: legal.terms.*/legal.privacy.* is the actual Terms of
// Service / Privacy Policy contract body, which src/app/legal/terms/page.tsx
// and legal/privacy/page.tsx intentionally keep English/Serbian-only (see
// their isFullyTranslated check and the legal.limitedLocaleNotice banner
// shown to every other locale). Translating that carve-out here would
// contradict that legal-risk containment, not fix a gap.
// =============================================================================
import fs from 'fs'
import path from 'path'
import { SUPPORTED_LANGS } from '@/i18n/shared'

import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'
import de from '@/i18n/locales/de'
import mk from '@/i18n/locales/mk'
import sq from '@/i18n/locales/sq'
import bg from '@/i18n/locales/bg'

const LOCALES: Record<string, Record<string, string>> = { en, sr, de, mk, sq, bg }

// SUPPORTED_LANGS is the contract this test enforces against — fail loudly if
// a locale is added/removed there without this map being updated to match.
test('LOCALES covers exactly SUPPORTED_LANGS', () => {
  expect(Object.keys(LOCALES).sort()).toEqual([...SUPPORTED_LANGS].sort())
})

const LEGAL_DOCUMENT_BODY_RE = /^legal\.(terms|privacy)\.(intro|s\d+\.(title|body))$/
const LOCALES_WITH_LEGAL_DOC_EXEMPTION = new Set(['de', 'mk', 'sq', 'bg'])

function isExempt(locale: string, key: string): boolean {
  return LOCALES_WITH_LEGAL_DOC_EXEMPTION.has(locale) && LEGAL_DOCUMENT_BODY_RE.test(key)
}

describe('key coverage against en (source of truth)', () => {
  const enKeys = Object.keys(en)

  for (const locale of SUPPORTED_LANGS) {
    if (locale === 'en') continue

    test(`${locale} has every en key, except the legal-document-body carve-out`, () => {
      const localeKeys = new Set(Object.keys(LOCALES[locale]))
      const missing = enKeys.filter((k) => !localeKeys.has(k) && !isExempt(locale, k))
      expect(missing).toEqual([])
    })
  }

  test('release-critical namespaces are never exempt, in any locale', () => {
    const neverExemptPrefixes = [
      'legal.riskAck.',
      'legal.consentRequired.',
      'legal.limitedLocaleNotice',
      'auth.register.consent',
      'auth.error.consentVersionStale',
      'inspection.lowCoverageWarning.',
      'inspection.insufficientCoverageNotice',
      'inspection.partialCoverageNotice',
      'inspection.aiConsent.',
      'report.',
      'report.photoCoverage.',
      'report.decision.',
      'report.visualNotAssessed',
    ]
    const guardedKeys = enKeys.filter((k) => neverExemptPrefixes.some((p) => k.startsWith(p)))
    expect(guardedKeys.length).toBeGreaterThan(0) // sanity: the prefixes above must actually match something

    for (const locale of SUPPORTED_LANGS) {
      if (locale === 'en') continue
      const localeKeys = new Set(Object.keys(LOCALES[locale]))
      const missing = guardedKeys.filter((k) => !localeKeys.has(k))
      expect({ locale, missing }).toEqual({ locale, missing: [] })
    }
  })
})

describe('en source-of-truth consistency', () => {
  // Guards against the exact regression found in the 2026-08-31 audit: these
  // keys existed in de/mk/sq/sr/bg but had been dropped from en.ts, so
  // fallbackLng had nothing left to fall back to for English-language users.
  const previouslyMissingFromEn = [
    'report.negotiationLeverageLabel',
    'report.negotiationLeverageIntro',
    'report.negotiationAskingPrice',
    'report.negotiationSuggestedReduction',
    'report.negotiationMinimumReduction',
    'report.negotiationUseFindings',
    'report.negotiationAdvisoryOnly',
    'report.negotiationSupportedBy',
    'report.negotiationDisclaimer',
    'inspection.prepReportDisclaimer',
  ]

  test('en still contains the keys recovered in the 2026-08-31 audit', () => {
    const enKeys = new Set(Object.keys(en))
    const missing = previouslyMissingFromEn.filter((k) => !enKeys.has(k))
    expect(missing).toEqual([])
  })
})

describe('interpolation placeholder parity', () => {
  function placeholders(value: string): string[] {
    return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]).sort()
  }

  for (const locale of SUPPORTED_LANGS) {
    if (locale === 'en') continue

    test(`${locale} uses the same {{placeholders}} as en for every shared key`, () => {
      const mismatches: Array<{ key: string; en: string[]; locale: string[] }> = []

      for (const [key, enValue] of Object.entries(en)) {
        if (isExempt(locale, key)) continue
        const localeValue = LOCALES[locale][key]
        if (localeValue === undefined) continue // already reported by the coverage test above

        const enPlaceholders = placeholders(enValue)
        if (enPlaceholders.length === 0) continue

        const localePlaceholders = placeholders(localeValue)
        if (enPlaceholders.join(',') !== localePlaceholders.join(',')) {
          mismatches.push({ key, en: enPlaceholders, locale: localePlaceholders })
        }
      }

      expect(mismatches).toEqual([])
    })
  }
})

describe('duplicate key safety', () => {
  // A duplicate property in an object literal doesn't throw — the later one
  // silently shadows the earlier translation. Only a static read of the
  // source text can catch this; the imported object has already deduplicated
  // by the time a test could inspect it at runtime.
  const KEY_LINE_RE = /^\s*'([a-zA-Z0-9_.]+)':/

  for (const locale of SUPPORTED_LANGS) {
    test(`${locale}.ts has no duplicate key declarations`, () => {
      const filePath = path.join(process.cwd(), `src/i18n/locales/${locale}.ts`)
      const lines = fs.readFileSync(filePath, 'utf8').split('\n')

      const seen = new Set<string>()
      const duplicates: string[] = []
      for (const line of lines) {
        const m = line.match(KEY_LINE_RE)
        if (!m) continue
        if (seen.has(m[1])) duplicates.push(m[1])
        else seen.add(m[1])
      }

      expect(duplicates).toEqual([])
    })
  }
})
