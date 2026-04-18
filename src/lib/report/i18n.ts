import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'
import de from '@/i18n/locales/de'
import mk from '@/i18n/locales/mk'
import sq from '@/i18n/locales/sq'
import { FALLBACK_LANG, isSupportedLang, type SupportedLang } from '@/i18n'

type LocaleDict = Record<string, string>

const dictionaries: Record<SupportedLang, LocaleDict> = {
  en,
  sr,
  de,
  mk,
  sq,
}

export type PdfTranslate = (key: string, vars?: Record<string, string | number>) => string

export function normalizePdfLocale(locale: string | undefined | null): SupportedLang {
  const language = (locale ?? '').split('-')[0]
  return isSupportedLang(language) ? language : FALLBACK_LANG
}

export function createPdfTranslator(locale: string | undefined | null): PdfTranslate {
  const language = normalizePdfLocale(locale)
  const active = dictionaries[language]
  const fallback = dictionaries[FALLBACK_LANG]

  return (key, vars) => {
    const template = active[key] ?? fallback[key] ?? key
    if (!vars) return template
    return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      const value = vars[name]
      return value === undefined ? `{{${name}}}` : String(value)
    })
  }
}

