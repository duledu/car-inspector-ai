'use client'

import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import '@/i18n/config'

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
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(34,211,238,0.28)',
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#050810" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>
            <span style={{ color: '#22d3ee' }}>Car Inspector</span> AI
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

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
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
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </section>
  )
}

function P({ children }: Readonly<{ children: React.ReactNode }>) {
  return <p style={{ margin: 0 }}>{children}</p>
}

function Ul({ items }: Readonly<{ items: string[] }>) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <li key={i} style={{ lineHeight: 1.7 }}>{item}</li>
      ))}
    </ul>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  const { t, i18n } = useTranslation()
  const isEnglish = i18n.language === 'en'

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
            {t('legal.privacy.title')}
          </div>
          <h1 style={{
            margin: '0 0 10px',
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 900, letterSpacing: '-1.2px', color: '#fff',
          }}>
            {t('legal.privacy.title')}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            {t('legal.lastUpdated')} April 13, 2026
          </p>
        </div>

        {/* Non-English notice */}
        {!isEnglish && (
          <div style={{
            marginBottom: 36, padding: '14px 18px',
            background: 'rgba(34,211,238,0.05)',
            border: '1px solid rgba(34,211,238,0.15)',
            borderRadius: 10,
            fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65,
          }}>
            {t('legal.englishOnly')}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 40 }} />

        {/* ── Sections ── */}

        <Section title="1. Introduction">
          <P>
            Used Cars Doctor ("we," "our," "us") operates the web application and Progressive Web Application available at{' '}
            <a href="https://usedcarsdoctor.com" style={{ color: '#22d3ee', textDecoration: 'none' }}>usedcarsdoctor.com</a>.
            This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our Service.
          </P>
          <P>
            By using the Service, you consent to the practices described in this policy. If you do not agree, please discontinue use immediately.
            This policy applies to all platforms on which the Service is available, including the website, PWA, and any future mobile releases (e.g., Android via Google Play).
          </P>
          <P>
            The Service provides AI-assisted decision support only. AI outputs, inspection scores, market estimates, and vehicle history summaries are not guarantees of a vehicle's condition, safety, legality, value, or history.
          </P>
        </Section>

        <Section title="2. Information We Collect">
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Account Data.</strong> When you register, we collect your name, email address, and a hashed password. If you sign in with Google, we receive your name, email address, and profile photo from Google.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Vehicle & Inspection Data.</strong> Information you enter about vehicles you are evaluating: make, model, year, VIN, mileage, asking price, inspection checklist responses, and notes.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Photos.</strong> Images you upload during the AI photo inspection phase. These are transmitted to our AI provider (OpenAI) for analysis. See Section 4 for details.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>AI Results.</strong> AI-generated findings, confidence scores, inspection summaries, risk scores, and related report content generated from your photos and inspection inputs.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Payment Data.</strong> If you purchase a premium report, payment is processed by Stripe. We do not store card numbers or full payment instrument details on our servers. We retain transaction records (amount, date, vehicle reference, and status) for billing and legal compliance.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Usage Data.</strong> Browser type, device type, IP address, pages visited, feature interactions, and general usage patterns collected to improve the Service.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Session Storage.</strong> Your authentication session is stored in browser sessionStorage on your device. It is not persisted across browser sessions.</P>
        </Section>

        <Section title="3. How We Use Your Information">
          <P>We use the information we collect to:</P>
          <Ul items={[
            'Provide and operate the Service, including AI-assisted analysis features',
            'Generate decision-support inspection outputs, risk scores, and report summaries',
            'Process and confirm premium report purchases',
            'Authenticate your account and maintain session security',
            'Communicate with you about your account, purchases, or service changes',
            'Improve the accuracy, quality, and reliability of AI features',
            'Comply with applicable legal obligations and enforce our Terms of Service',
            'Detect and prevent fraud, abuse, or security incidents',
          ]} />
          <P>We do not sell, rent, or trade your personal data to third parties for their marketing purposes.</P>
        </Section>

        <Section title="4. Data Sharing & Third-Party Services">
          <P>We share data only with service providers essential to delivering the Service:</P>
          <Ul items={[
            'Neon Technologies (neon.tech) — Database hosting. Your account, vehicle, and inspection data is stored in a Neon PostgreSQL instance. Data is hosted on AWS infrastructure in the EU.',
            'OpenAI — Your vehicle photos and relevant inspection context are submitted to the OpenAI API to generate AI analysis results. OpenAI processes this data subject to their own privacy policy and API usage policies.',
            'Stripe — Payment processing. Stripe handles all card data and payment flows. We share only the minimum information required to initiate and confirm transactions.',
            'carVertical / autoDNA — When you purchase a premium vehicle history report, your vehicle\'s VIN is submitted to carVertical or associated data partners to retrieve history records.',
            'Cloudflare (if applicable) — CDN, DNS management, and DDoS protection. Cloudflare may process request metadata (IP address, headers) as part of its network security services.',
          ]} />
          <P>We do not share your personal data with advertisers, data brokers, or unaffiliated third parties for any other purpose.</P>
        </Section>

        <Section title="5. Data Storage & Security">
          <P>Your data is stored in a PostgreSQL database hosted by Neon Technologies on AWS infrastructure within the European Union. Data is encrypted in transit using TLS/SSL.</P>
          <P>We implement technical and organizational measures to protect your data, including access controls, environment separation, and secure key management. However, no method of transmission over the Internet or method of electronic storage is 100% secure. We cannot guarantee absolute security.</P>
          <P>In the event of a data breach that affects your rights and freedoms, we will notify you and the relevant supervisory authority as required by applicable law.</P>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your account and inspection data for as long as your account is active. You may request deletion of your account and associated data at any time from the{' '}
            <Link href="/legal/account-deletion" style={{ color: '#22d3ee', textDecoration: 'none' }}>Account Deletion</Link>{' '}
            page or by contacting us (see Section 11).
          </P>
          <P>Payment transaction records may be retained for up to 7 years as required by applicable accounting and tax laws, even after account deletion. AI analysis results and inspection reports may be retained while your account remains active so you can access your inspection history. Raw photo handling depends on the feature used and the storage provider involved; where photos are processed only for analysis, we limit retention to what is necessary to provide the Service and maintain security.</P>
        </Section>

        <Section title="7. Your Rights (GDPR & EEA/UK Users)">
          <P>If you are located in the European Economic Area (EEA) or the United Kingdom, you have the following rights regarding your personal data under the General Data Protection Regulation (GDPR) or equivalent legislation:</P>
          <Ul items={[
            'Right of Access — Request a copy of the personal data we hold about you.',
            'Right to Rectification — Request correction of inaccurate or incomplete personal data.',
            'Right to Erasure — Request deletion of your personal data, subject to legal retention obligations.',
            'Right to Restriction of Processing — Request that we restrict processing of your data in certain circumstances.',
            'Right to Data Portability — Receive your data in a structured, commonly used, machine-readable format.',
            'Right to Object — Object to processing based on legitimate interests or direct marketing.',
            'Right to Lodge a Complaint — Lodge a complaint with the relevant data protection supervisory authority in your jurisdiction.',
          ]} />
          <P>To exercise any of these rights, contact us at the email address provided in Section 11. We will respond within 30 days.</P>
        </Section>

        <Section title="8. Cookies & Local Storage">
          <P>We use the following cookies and browser storage:</P>
          <Ul items={[
            'Authentication cookie — A session token used to maintain your signed-in state.',
            'Language preference cookie — Stores your selected language (e.g., "en", "sr"). Expires after 365 days.',
            'Session storage — Used to store your authentication session data locally on your device. Cleared when the browser tab is closed.',
          ]} />
          <P>We do not use advertising cookies, cross-site tracking cookies, or third-party analytics cookies. We do not use Google Analytics or similar tracking services.</P>
        </Section>

        <Section title="9. Children's Privacy">
          <P>The Service is not directed at individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe that your child has provided us with personal data without your consent, please contact us and we will take steps to delete such information promptly.</P>
        </Section>

        <Section title="10. Changes to This Policy">
          <P>We may update this Privacy Policy from time to time. Material changes will be communicated by updating the "Last updated" date at the top of this page and, where appropriate, by sending a notification to the email address associated with your account.</P>
          <P>Your continued use of the Service after any changes constitutes your acceptance of the revised Privacy Policy. We encourage you to review this page periodically.</P>
        </Section>

        <Section title="11. Contact Us">
          <P>For privacy-related questions, data access requests, erasure requests, or complaints, please contact us:</P>
          <Ul items={[
            'Email: contact@usedcarsdoctor.com',
            'Website: https://usedcarsdoctor.com',
          ]} />
        </Section>

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
          <Link href="/legal/terms" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
            {t('legal.terms.title')} →
          </Link>
        </div>
      </main>
    </div>
  )
}
