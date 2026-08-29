'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { LegalBody } from '../LegalBody'
import { CURRENT_TERMS_VERSION, LEGAL_EFFECTIVE_DATE } from '@/lib/legal/legal-config'
import { TERMS_CONTENT_KEYS } from '@/lib/legal/legal-content-manifest'
import '@/i18n/config'

// TERMS_CONTENT_KEYS is ['legal.terms.intro', ...26 x (title, body)] — derive
// the section count from it so the manifest stays the single source of truth.
const TERMS_SECTION_COUNT = (TERMS_CONTENT_KEYS.length - 1) / 2

// ── Shared legal page shell ────────────────────────────────────────────────

function LegalHeader() {
  const { t } = useTranslation()
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(8,12,20,0.95)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
    }}>
      <div style={{
        maxWidth: 860, margin: '0 auto',
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.svg" alt="" height={28} style={{ width: 'auto', flexShrink: 0, display: 'block' }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
            Used Cars Doctor
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LanguageSwitcher />
          {/* Back */}
          <Link href="/" style={{
            fontSize: 12, fontWeight: 500,
            color: 'rgba(255,255,255,0.45)',
            textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 12px',
            borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.color = '#fff'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {t('legal.backToHome')}
          </Link>
        </div>
      </div>
    </header>
  )
}

// ── Section component ──────────────────────────────────────────────────────

function Section({ title, body }: Readonly<{ title: string; body: string }>) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        margin: '0 0 14px',
        fontSize: 17,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '-0.3px',
        paddingLeft: 14,
        borderLeft: '3px solid #22d3ee',
        lineHeight: 1.3,
      }}>
        {title}
      </h2>
      <LegalBody text={body} />
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TermsPage() {
  const { t, i18n } = useTranslation()
  // English and Serbian are both complete, legally binding translations —
  // the "this is an automatic translation" notice must never show for
  // either. It shows for every other currently-supported locale, which
  // still fall back to the English text via i18next's fallbackLng.
  const isFullyTranslated = i18n.language === 'en' || i18n.language === 'sr'

  const sections = Array.from({ length: TERMS_SECTION_COUNT }, (_, i) => i + 1)

  return (
    <div style={{ minHeight: '100svh', background: '#080c14', color: '#fff', fontFamily: 'var(--font-sans)' }}>
      <LegalHeader />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(32px, 5vw, 64px) 24px 80px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#22d3ee', marginBottom: 12,
          }}>
            {t('legal.terms.title')}
          </div>
          <h1 style={{
            margin: '0 0 10px',
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 900, letterSpacing: '-1.2px', color: '#fff',
          }}>
            {t('legal.terms.title')}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {t('legal.lastUpdated')} {LEGAL_EFFECTIVE_DATE} · {t('legal.version')} {CURRENT_TERMS_VERSION}
          </p>
        </div>

        {/* Notice for locales without a complete legal translation */}
        {!isFullyTranslated && (
          <div style={{
            marginBottom: 36, padding: '14px 18px',
            background: 'rgba(34,211,238,0.05)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 10,
            fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65,
          }}>
            {t('legal.limitedLocaleNotice')}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 40 }} />

        {/* Intro */}
        <p style={{ margin: '0 0 32px', fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8 }}>
          {t('legal.terms.intro')}
        </p>

        {/* ── Sections ── */}
        {sections.map((n) => (
          <Section key={n} title={t(`legal.terms.s${n}.title`)} body={t(`legal.terms.s${n}.body`)} />
        ))}

        {/* Bottom links */}
        <div style={{
          marginTop: 56,
          paddingTop: 28,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
            ← {t('legal.backToHome')}
          </Link>
          <Link href="/legal/privacy" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
            ← {t('legal.privacy.title')}
          </Link>
        </div>
      </main>
    </div>
  )
}
