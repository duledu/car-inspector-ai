'use client'

// =============================================================================
// LanguageSwitcher — compact dropdown that persists language choice.
// Designed to slot into the Topbar right-controls area.
// =============================================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS, LANG_META, LS_KEY, LANG_COOKIE } from '@/i18n'
import type { SupportedLang } from '@/i18n'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  const current = (
    (SUPPORTED_LANGS as readonly string[]).includes(i18n.language)
      ? i18n.language
      : 'en'
  ) as SupportedLang

  const switchTo = useCallback((lang: SupportedLang) => {
    if (lang === current) { setOpen(false); return }
    i18n.changeLanguage(lang)
    try { localStorage.setItem(LS_KEY, lang) } catch { /* ignore */ }
    document.cookie = `${LANG_COOKIE}=${encodeURIComponent(lang)}; Path=/; Max-Age=31536000; SameSite=Lax`
    setOpen(false)
  }, [current, i18n])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const meta = LANG_META[current]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Switch language"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 9px',
          background: open ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(34,211,238,0.28)' : 'rgba(255,255,255,0.09)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 16, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 3, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.7)', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>{meta.countryCode}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: open ? '#22d3ee' : 'rgba(255,255,255,0.55)', letterSpacing: '0.04em' }}>
          {meta.label}
        </span>
        <svg
          width="9" height="9" viewBox="0 0 10 10" fill="none"
          style={{ color: open ? '#22d3ee' : 'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 150,
            background: 'rgba(10,14,24,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
            overflow: 'hidden',
            zIndex: 200,
          }}
        >
          {SUPPORTED_LANGS.map((lang) => {
            const m = LANG_META[lang]
            const isActive = lang === current
            return (
              <button
                key={lang}
                role="option"
                aria-selected={isActive}
                onClick={() => switchTo(lang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  width: '100%',
                  padding: '10px 13px',
                  background: isActive ? 'rgba(34,211,238,0.08)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  textAlign: 'left',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 3, fontSize: 8, fontWeight: 800, letterSpacing: '0.05em', color: 'rgba(255,255,255,0.6)', flexShrink: 0, fontFamily: 'var(--font-sans)' }}>{m.countryCode}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? '#22d3ee' : 'rgba(255,255,255,0.75)', lineHeight: 1.2 }}>
                    {m.full}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', lineHeight: 1.2 }}>
                    {m.label}
                  </div>
                </div>
                {isActive && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
