export const SUPPORTED_LANGS = ['en', 'sr', 'de', 'mk', 'sq'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

export const FALLBACK_LANG: SupportedLang = 'en'
export const LS_KEY = 'car_inspector_lang'
export const LANG_COOKIE = 'car_inspector_lang'

export const LANG_META: Record<SupportedLang, { label: string; flag: string; full: string }> = {
  en: { label: 'EN', flag: '🇬🇧', full: 'English' },
  sr: { label: 'SR', flag: '🇷🇸', full: 'Srpski' },
  de: { label: 'DE', flag: '🇩🇪', full: 'Deutsch' },
  mk: { label: 'МК', flag: '🇲🇰', full: 'Македонски' },
  sq: { label: 'SQ', flag: '🇦🇱', full: 'Shqip' },
}

export function isSupportedLang(value: string | undefined | null): value is SupportedLang {
  return !!value && (SUPPORTED_LANGS as readonly string[]).includes(value)
}
