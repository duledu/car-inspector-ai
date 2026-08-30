// =============================================================================
// Evidence/coverage score-cap — translation coverage across every locale
//
// This is a release requirement: no locale may silently fall back to English
// or display a raw i18n key for the new score-cap label/notice. Enumerates
// every locale this app actually ships (from SUPPORTED_LANGS, not an
// assumed EN/SR-only list) and verifies each one carries a real, distinct
// translation for both new keys — not just EN and SR.
// =============================================================================

import { SUPPORTED_LANGS } from '@/i18n/shared'
import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'
import de from '@/i18n/locales/de'
import mk from '@/i18n/locales/mk'
import sq from '@/i18n/locales/sq'
import bg from '@/i18n/locales/bg'

const DICTIONARIES: Record<string, Record<string, string>> = { en, sr, de, mk, sq, bg }

const NEW_KEYS = [
  'report.scoreLabel.limitedEvidence',
  'report.scoreCappedNotice',
] as const

describe('score-cap i18n — every supported locale is actually shipped', () => {
  it('SUPPORTED_LANGS matches the 6 locale dictionaries this test covers (fails loudly if a new locale is added and forgotten here)', () => {
    expect([...SUPPORTED_LANGS].sort()).toEqual(Object.keys(DICTIONARIES).sort())
  })
})

describe('score-cap i18n — new keys exist, are non-empty, and are real translations', () => {
  it.each(SUPPORTED_LANGS)('locale "%s" has a real, non-empty, non-echoing value for every new score-cap key', (lang) => {
    const dict = DICTIONARIES[lang]
    for (const key of NEW_KEYS) {
      const value = dict[key]
      expect(typeof value).toBe('string')
      expect((value ?? '').trim().length).toBeGreaterThan(0)
      // Never allow the raw key to leak through as if it were the translation.
      expect(value).not.toBe(key)
    }
  })

  it('every locale\'s two new strings are distinct from each other (not a copy-paste placeholder)', () => {
    for (const lang of SUPPORTED_LANGS) {
      const dict = DICTIONARIES[lang]
      const values = NEW_KEYS.map((k) => dict[k])
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('non-English locales are not silently reusing the English string (a real translation, not an English passthrough)', () => {
    for (const lang of SUPPORTED_LANGS) {
      if (lang === 'en') continue
      const dict = DICTIONARIES[lang]
      for (const key of NEW_KEYS) {
        expect(dict[key]).not.toBe(en[key as keyof typeof en])
      }
    }
  })

  it('the capped-score notice explicitly distinguishes missing evidence from a detected defect in every locale', () => {
    // Loose, language-agnostic sanity check: every translation must contain
    // wording for "not/no" alongside "problem/issue/defect" (i.e. actively
    // deny that a fault was found), not just describe a limitation.
    const negativeMarkers: Record<string, RegExp> = {
      en: /does not mean.*(problem|found)/i,
      sr: /ne znači.*(problem|pronađen)/i,
      de: /bedeutet nicht.*(problem|gefunden)/i,
      mk: /не значи.*(проблем|пронајден)/i,
      sq: /nuk do të thotë.*(problem|gjet)/i,
      bg: /не означава.*(проблем|открит)/i,
    }
    for (const lang of SUPPORTED_LANGS) {
      const notice = DICTIONARIES[lang]['report.scoreCappedNotice']
      expect(notice).toMatch(negativeMarkers[lang])
    }
  })
})
