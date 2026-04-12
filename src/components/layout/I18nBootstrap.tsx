'use client'

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import i18n from '@/i18n/config'
import { LANG_COOKIE, LS_KEY, isSupportedLang } from '@/i18n/shared'
import type { SupportedLang } from '@/i18n/shared'

function readLegacyStoredLang(): SupportedLang | null {
  try {
    const stored = localStorage.getItem(LS_KEY)
    return isSupportedLang(stored) ? stored : null
  } catch {
    return null
  }
}

export function I18nBootstrap({
  initialLocale,
  children,
}: Readonly<{ initialLocale: SupportedLang; children: ReactNode }>) {
  if (i18n.language !== initialLocale) {
    i18n.changeLanguage(initialLocale)
  }

  useEffect(() => {
    const hasCookie = document.cookie
      .split('; ')
      .some(row => row.startsWith(`${LANG_COOKIE}=`))
    if (hasCookie) return

    const legacy = readLegacyStoredLang()
    if (!legacy || legacy === initialLocale) return

    document.cookie = `${LANG_COOKIE}=${encodeURIComponent(legacy)}; Path=/; Max-Age=31536000; SameSite=Lax`
    if (i18n.language !== legacy) {
      i18n.changeLanguage(legacy)
    }
  }, [initialLocale])

  return <>{children}</>
}
