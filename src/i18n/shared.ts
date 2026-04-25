export const SUPPORTED_LANGS = ['en', 'sr', 'de', 'mk', 'sq', 'bg'] as const
export type SupportedLang = (typeof SUPPORTED_LANGS)[number]

export const FALLBACK_LANG: SupportedLang = 'en'
export const LS_KEY = 'car_inspector_lang'
export const LANG_COOKIE = 'car_inspector_lang'

export const LANG_META: Record<SupportedLang, { label: string; countryCode: string; full: string }> = {
  en: { label: 'EN', countryCode: 'GB', full: 'English' },
  sr: { label: 'SR', countryCode: 'RS', full: 'Srpski' },
  de: { label: 'DE', countryCode: 'DE', full: 'Deutsch' },
  mk: { label: 'MK', countryCode: 'MK', full: 'Македонски' },
  sq: { label: 'SQ', countryCode: 'AL', full: 'Shqip' },
  bg: { label: 'BG', countryCode: 'BG', full: 'Български' },
}

export function isSupportedLang(value: string | undefined | null): value is SupportedLang {
  return !!value && (SUPPORTED_LANGS as readonly string[]).includes(value)
}
