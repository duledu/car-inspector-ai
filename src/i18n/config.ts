// =============================================================================
// i18n Configuration — react-i18next
//
// • English is ALWAYS the default language.
// • Language NEVER auto-switches based on browser/device settings.
// • The only way to change language is via the LanguageSwitcher component
//   (explicit user action), which writes the choice to localStorage.
// • On boot: read localStorage → use that lang OR fall back to 'en'.
// • Translations are bundled (no async loading = no flash of raw keys).
// =============================================================================

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import en from './locales/en'
import sr from './locales/sr'
import de from './locales/de'
import mk from './locales/mk'
import sq from './locales/sq'

// ─── Constants (exported for LanguageSwitcher and pwa.tsx) ────────────────────

export const SUPPORTED_LANGS = ['en', 'sr', 'de', 'mk', 'sq'] as const
export type SupportedLang     = (typeof SUPPORTED_LANGS)[number]
export const FALLBACK_LANG: SupportedLang = 'en'
export const LS_KEY = 'car_inspector_lang'

export const LANG_META: Record<SupportedLang, { label: string; flag: string; full: string }> = {
  en: { label: 'EN', flag: '🇬🇧', full: 'English'     },
  sr: { label: 'SR', flag: '🇷🇸', full: 'Srpski'      },
  de: { label: 'DE', flag: '🇩🇪', full: 'Deutsch'     },
  mk: { label: 'МК', flag: '🇲🇰', full: 'Македонски'  },
  sq: { label: 'SQ', flag: '🇦🇱', full: 'Shqip'       },
}

// ─── Determine initial language ───────────────────────────────────────────────
// Always start with FALLBACK_LANG ('en') on BOTH the server and the client's
// initial render. This guarantees the SSR output and the client's first paint
// are identical — no React hydration mismatch.
//
// The stored language preference is applied AFTER hydration in pwa.tsx via
// i18n.changeLanguage(), which is safe to call post-mount.
//
// Do NOT read localStorage here — module-level code runs during the client
// render phase, before React can reconcile, so any mismatch with SSR output
// will throw a hydration error.

function getInitialLang(): SupportedLang {
  return FALLBACK_LANG   // 'en' on both server and client initial render
}

// ─── Init (idempotent — safe to import multiple times) ────────────────────────

if (!i18n.isInitialized) {
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
      lng:           getInitialLang(),   // explicit — no auto-detection
      fallbackLng:   FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGS,
      // Prevent react-i18next from splitting keys on dots
      keySeparator:  false,
      nsSeparator:   false,
      interpolation: { escapeValue: false },
      react:         { useSuspense: false },
    })
}

export default i18n
