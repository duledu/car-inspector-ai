// =============================================================================
// Legal wording invariants
//
// Locks in two specific wording fixes required by the liability/consent
// architecture work so they can't silently regress:
//   1. "Professional Inspection Report" (and title-cased variants) is a
//      self-contradiction — the product disclaims being a professional
//      inspection everywhere else, so this exact product-naming phrase must
//      never reappear. Note: disclaiming language like "does not replace a
//      professional vehicle inspection" is fine and expected — this check
//      only bans the affirmative product-naming phrase, not the negation.
//   2. Progress/completion strings must say "checklist complete", never a
//      bare "100%"/"complete" that could be misread as a claim about the
//      vehicle's actual condition.
// =============================================================================

import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'

const LOCALES: Record<string, Record<string, string>> = { en: en as any, sr: sr as any }

const BANNED_PATTERNS = [
  /professional\s+inspection\s+report/i,
]

describe('banned "Professional Inspection Report" wording', () => {
  for (const [lang, dict] of Object.entries(LOCALES)) {
    it(`${lang}.ts contains no self-contradicting "Professional Inspection Report" phrasing`, () => {
      const offenders = Object.entries(dict).filter(([, value]) =>
        typeof value === 'string' && BANNED_PATTERNS.some((re) => re.test(value)),
      )
      expect(offenders).toEqual([])
    })
  }
})

describe('unambiguous checklist-completion wording', () => {
  it('dashboard.resumeComplete mentions "checklist" (not a bare completion percentage)', () => {
    expect(en['dashboard.resumeComplete']).toMatch(/checklist/i)
    expect(sr['dashboard.resumeComplete']).toMatch(/kontrolne liste/i)
  })

  it('report.progressPercent qualifies the percentage with "checklist"', () => {
    expect(en['report.progressPercent']).toMatch(/checklist/i)
    expect(sr['report.progressPercent']).toMatch(/kontrolne liste/i)
  })

  it('inspection.allPhasesComplete refers to the checklist, not the vehicle', () => {
    expect(en['inspection.allPhasesComplete']).toMatch(/checklist/i)
    expect(sr['inspection.allPhasesComplete']).toMatch(/kontrolne liste/i)
  })
})

describe('en/sr key parity for legal content', () => {
  it('every legal.* key present in en.ts also exists in sr.ts and vice versa', () => {
    const enLegalKeys = Object.keys(en).filter((k) => k.startsWith('legal.')).sort()
    const srLegalKeys = Object.keys(sr).filter((k) => k.startsWith('legal.')).sort()
    expect(srLegalKeys).toEqual(enLegalKeys)
  })

  it('every legal.* value is a non-empty string in both locales', () => {
    for (const key of Object.keys(en).filter((k) => k.startsWith('legal.'))) {
      expect(typeof en[key]).toBe('string')
      expect((en[key] as string).length).toBeGreaterThan(0)
      expect(typeof sr[key]).toBe('string')
      expect((sr[key] as string).length).toBeGreaterThan(0)
    }
  })
})
