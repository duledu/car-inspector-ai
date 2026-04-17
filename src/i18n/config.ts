'use client'

// =============================================================================
// i18n Configuration - react-i18next
// Client-only module. Do not import this from Server Components.
// =============================================================================

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { FALLBACK_LANG, LANG_COOKIE, SUPPORTED_LANGS, isSupportedLang } from './shared'
import type { SupportedLang } from './shared'

import en from './locales/en'
import sr from './locales/sr'
import de from './locales/de'
import mk from './locales/mk'
import sq from './locales/sq'

function readCookieLang(): SupportedLang | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${LANG_COOKIE}=`))
  const value = match ? decodeURIComponent(match.split('=')[1] ?? '') : null
  return isSupportedLang(value) ? value : null
}

function getInitialLang(): SupportedLang {
  return readCookieLang() ?? FALLBACK_LANG
}

if (i18n.isInitialized) {
  // Re-apply locale bundles on HMR re-evaluation so locale file edits
  // are visible without a full server restart.
  i18n.addResourceBundle('en', 'translation', en, true, true)
  i18n.addResourceBundle('sr', 'translation', sr, true, true)
  i18n.addResourceBundle('de', 'translation', de, true, true)
  i18n.addResourceBundle('mk', 'translation', mk, true, true)
  i18n.addResourceBundle('sq', 'translation', sq, true, true)
} else {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        sr: { translation: sr },
        de: { translation: de },
        mk: { translation: mk },
        sq: { translation: sq },
      },
      lng: getInitialLang(),
      fallbackLng: FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGS,
      keySeparator: false,
      nsSeparator: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    })
}

export default i18n
