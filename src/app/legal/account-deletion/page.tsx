'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import '@/i18n/config'

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section style={{ marginBottom: 36 }}>
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
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}

function P({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p style={{ margin: 0 }}>{children}</p>
}

function Ul({ items }: Readonly<{ items: React.ReactNode[] }>) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={i} style={{ lineHeight: 1.7 }}>{item}</li>
      ))}
    </ul>
  )
}

export default function AccountDeletionPage() {
  const { t } = useTranslation()

  return (
    <div style={{ minHeight: '100svh', background: '#080c14', color: '#fff', fontFamily: 'var(--font-sans)' }}>
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
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 9,
              background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px rgba(34,211,238,0.28)',
              flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#050810" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
              Used Cars Doctor
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher />
            <Link href="/" style={{
              fontSize: 12, fontWeight: 500,
              color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px',
              borderRadius: 7,
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {t('legal.backToHome')}
            </Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(32px, 5vw, 64px) 24px 80px' }}>
        <div style={{ marginBottom: 36 }}>
          <div style={{
            display: 'inline-block',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            color: '#22d3ee', marginBottom: 12,
          }}>
            Account deletion
          </div>
          <h1 style={{
            margin: '0 0 10px',
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 900, letterSpacing: '-1.2px', color: '#fff',
          }}>
            Delete your Used Cars Doctor account
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Last updated: April 16, 2026
          </p>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 40 }} />

        <Section title="How to request deletion">
          <P>You can request deletion of your Used Cars Doctor account and associated app data from inside the app or from the web.</P>
          <Ul items={[
            <>In the app: sign in, open <strong style={{ color: 'rgba(255,255,255,0.82)' }}>Profile</strong>, then use the <strong style={{ color: 'rgba(255,255,255,0.82)' }}>Account deletion</strong> link.</>,
            <>On the web: email <a href="mailto:contact@usedcarsdoctor.com?subject=Account%20deletion%20request" style={{ color: '#22d3ee', textDecoration: 'none' }}>contact@usedcarsdoctor.com</a> with the subject <strong style={{ color: 'rgba(255,255,255,0.82)' }}>Account deletion request</strong>.</>,
            'Include the email address used for your account so we can verify and process the request.',
          ]} />
        </Section>

        <Section title="What will be deleted">
          <P>After verification, we delete or anonymize account data associated with your account, including profile details, saved vehicles, inspection sessions, checklist data, AI analysis results, reports, and related app content where deletion is legally permitted.</P>
          <P>Payment transaction records may be retained where required for accounting, fraud prevention, chargeback handling, tax, or other legal compliance obligations.</P>
        </Section>

        <Section title="Timing">
          <P>We aim to respond to deletion requests within 30 days. If we need more information to verify ownership of the account, we will contact you using the email address associated with the request.</P>
        </Section>

        <Section title="Privacy policy">
          <P>
            For more detail about data collection, retention, and deletion rights, review the{' '}
            <Link href="/legal/privacy" style={{ color: '#22d3ee', textDecoration: 'none' }}>
              Privacy Policy
            </Link>.
          </P>
        </Section>

        <div style={{
          marginTop: 56,
          paddingTop: 28,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          justifyContent: 'space-between', gap: 12,
        }}>
          <Link href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
            {t('legal.backToHome')}
          </Link>
          <Link href="/legal/privacy" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
            {t('legal.privacy.title')}
          </Link>
        </div>
      </main>
    </div>
  )
}
