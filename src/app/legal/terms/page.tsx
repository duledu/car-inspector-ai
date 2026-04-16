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

function WarningBox({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{
      padding: '14px 18px',
      background: 'rgba(251,191,36,0.05)',
      border: '1px solid rgba(251,191,36,0.2)',
      borderRadius: 10,
      fontSize: 13,
      color: 'rgba(255,255,255,0.65)',
      lineHeight: 1.7,
    }}>
      {children}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function TermsPage() {
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

        <Section title="1. Acceptance of Terms">
          <P>
            These Terms of Service ("Terms") govern your access to and use of the Used Cars Doctor web application and Progressive Web Application (the "Service") operated by Used Cars Doctor ("we," "our," "us"), available at{' '}
            <a href="https://usedcarsdoctor.com" style={{ color: '#22d3ee', textDecoration: 'none' }}>usedcarsdoctor.com</a>.
          </P>
          <P>
            By accessing or using the Service, you confirm that you are at least 13 years of age and agree to be bound by these Terms and our{' '}
            <Link href="/legal/privacy" style={{ color: '#22d3ee', textDecoration: 'none' }}>{t('legal.privacy.title')}</Link>.
            If you do not agree, do not use the Service.
          </P>
          <P>
            These Terms apply to all platforms on which the Service is available, including the website, PWA, and any future mobile releases (e.g., Android via Google Play).
          </P>
        </Section>

        <Section title="2. Description of Service">
          <P>
            Used Cars Doctor is an AI-assisted tool designed to help individuals evaluate used vehicles before purchase. The Service provides:
          </P>
          <Ul items={[
            'Step-by-step guided inspection checklists for evaluating used vehicles',
            'AI-assisted photo analysis to highlight visible defects, paint issues, and condition concerns from user-uploaded images',
            'AI-generated inspection summaries and risk assessments based on user-entered data',
            'Optional premium vehicle history reports sourced from third-party data providers (carVertical / autoDNA)',
            'PDF export of completed inspection reports',
            'Account management and inspection history storage',
          ]} />
        </Section>

        <Section title="3. User Accounts">
          <P>You may create an account using an email address and password or by signing in with Google. You are responsible for:</P>
          <Ul items={[
            'Maintaining the confidentiality of your account credentials',
            'All activity that occurs under your account',
            'Notifying us immediately of any unauthorized use of your account',
          ]} />
          <P>We reserve the right to suspend or terminate accounts that violate these Terms, engage in fraudulent activity, or are inactive for an extended period, with or without prior notice depending on the severity of the violation.</P>
        </Section>

        <Section title="4. Acceptable Use">
          <P>You agree to use the Service only for lawful purposes and in accordance with these Terms. You must not:</P>
          <Ul items={[
            'Use the Service for any commercial vehicle inspection business or resale of AI-generated reports without our written consent',
            'Upload photos or content that you do not own or do not have the right to submit',
            'Attempt to reverse-engineer, scrape, or extract data from the Service by automated means',
            'Submit false, misleading, or fraudulent vehicle information',
            'Use the Service to harass, harm, or deceive any person',
            'Attempt to circumvent subscription limits, payment gates, or access controls',
            'Share, resell, or publish premium reports in a way that bypasses our paid feature protections or third-party provider restrictions',
            'Interfere with or disrupt the integrity or performance of the Service',
          ]} />
        </Section>

        <Section title="5. AI Analysis — Important Disclaimer">
          <WarningBox>
            <strong style={{ color: '#fbbf24', display: 'block', marginBottom: 6 }}>
              AI ANALYSIS IS NOT A PROFESSIONAL INSPECTION
            </strong>
            The AI-generated analysis, summaries, and risk assessments provided by the Service are produced by automated machine learning models and are provided for informational and guidance purposes only. They do not constitute a professional vehicle inspection, mechanical assessment, or expert opinion of any kind.
          </WarningBox>
          <P>
            AI models can and do make errors. They may miss defects that are not clearly visible in photos, misidentify conditions, or fail to detect issues that require physical examination by a qualified mechanic. The accuracy of AI analysis is dependent on the quality, angle, and completeness of the photos and data you provide.
          </P>
          <P>
            Photo-based analysis is advisory only. Results generated from photos may be incomplete or inaccurate and are not a guaranteed diagnosis or professional mechanical inspection. You should verify important findings with a qualified mechanic or in-person inspection.
          </P>
          <P>
            The Service does not guarantee any vehicle's condition, history, mileage, value, safety, roadworthiness, legal status, ownership status, accident history, or suitability for purchase. You remain solely responsible for independent due diligence before buying, selling, registering, financing, or driving any vehicle.
          </P>
          <P>
            <strong style={{ color: 'rgba(255,255,255,0.82)' }}>We strongly recommend</strong> that any vehicle purchase decision be made only after a physical inspection by a licensed, qualified mechanic or automotive technician. The Service is intended to supplement, not replace, professional inspection.
          </P>
          <P>
            WE EXPRESSLY DISCLAIM ALL LIABILITY FOR ANY VEHICLE PURCHASE DECISION MADE IN RELIANCE ON AI-GENERATED ANALYSIS, PHOTO ASSESSMENTS, OR INSPECTION SUMMARIES PROVIDED BY THE SERVICE.
          </P>
        </Section>

        <Section title="6. Photo Uploads">
          <P>When you upload photos through the Service:</P>
          <Ul items={[
            'You grant us a limited, non-exclusive license to transmit those photos to our AI provider (OpenAI) solely for the purpose of generating analysis results for your session.',
            'You represent that you have the right to upload and submit the images.',
            'Photos are not stored by us beyond the duration of the analysis request.',
            'You must not upload photos containing personally identifiable information about individuals (e.g., faces, license plates visible with personal context) beyond what is necessary for vehicle identification.',
          ]} />
          <P>We do not claim ownership of your uploaded photos. The limited license granted above terminates upon completion of the analysis request.</P>
        </Section>

        <Section title="7. Premium Reports & Payments">
          <P>
            Certain features, including vehicle history reports, require a one-time payment. Payments are processed by Stripe, a third-party payment processor. By making a purchase, you also agree to Stripe's terms of service.
          </P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Refund Policy.</strong> All purchases are final and non-refundable, except where required by applicable law. Because vehicle history reports are retrieved in real time from third-party data providers (carVertical / autoDNA) upon purchase, the service is considered delivered immediately and refunds are not available once a report has been retrieved.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Report Accuracy.</strong> Vehicle history reports are sourced from third-party data partners and reflect the data available in their databases at the time of the request. We do not guarantee the accuracy, completeness, or currency of vehicle history data. We are not liable for any errors or omissions in third-party history reports.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Access Controls.</strong> Premium content is licensed for your personal use in connection with the specific vehicle and purchase shown in the Service. We may restrict, suspend, or revoke access if we detect abuse, fraud, chargeback misuse, account sharing, or attempts to bypass payment protections.</P>
          <P><strong style={{ color: 'rgba(255,255,255,0.82)' }}>Pricing.</strong> Prices are displayed in EUR and are subject to change. You will always see the price before confirming any purchase.</P>
        </Section>

        <Section title="8. Intellectual Property">
          <P>
            The Service, including its design, software, AI models, workflows, branding, and all original content created by us, is owned by Used Cars Doctor and protected by copyright, trademark, and other intellectual property laws.
          </P>
          <P>
            You retain ownership of any data, vehicle information, and photos you submit. You grant us a limited license to use that data solely to provide the Service to you as described in these Terms and our Privacy Policy.
          </P>
          <P>
            You may not copy, reproduce, distribute, publish, modify, or create derivative works from the Service or its content without our prior written consent.
          </P>
        </Section>

        <Section title="9. Third-Party Services">
          <P>The Service integrates with third-party providers including OpenAI (AI analysis), Stripe (payments), carVertical / autoDNA (vehicle history), Neon Technologies (database), and Google (authentication). Your use of the Service involves data being processed by these providers, subject to their respective terms and privacy policies.</P>
          <P>We are not responsible for the availability, accuracy, or conduct of any third-party service. Links to or integrations with third-party services do not constitute our endorsement of those services.</P>
        </Section>

        <Section title="10. Disclaimers of Warranties">
          <P>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </P>
          <P>
            We do not warrant that the Service will be uninterrupted, error-free, secure, or free of viruses. We do not warrant the accuracy or reliability of any AI-generated content, vehicle analysis, or history report data. We do not warrant that any defect or error will be corrected.
          </P>
          <P>
            Some jurisdictions do not allow the exclusion of implied warranties; in such cases, the above exclusions apply to the fullest extent permitted by law.
          </P>
        </Section>

        <Section title="11. Limitation of Liability">
          <P>
            TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL USED CAR INSPECTOR AI, ITS OPERATORS, AFFILIATES, LICENSORS, OR SERVICE PROVIDERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, LOSS OF GOODWILL, COST OF SUBSTITUTE GOODS OR SERVICES, OR DAMAGES ARISING FROM A VEHICLE PURCHASE DECISION MADE BASED ON THE SERVICE.
          </P>
          <P>
            IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR €10 EUR IF YOU HAVE MADE NO PAYMENTS.
          </P>
          <P>
            Some jurisdictions do not allow limitations on liability for certain types of damages; in such cases, the above limitations apply to the fullest extent permitted by law.
          </P>
        </Section>

        <Section title="12. Indemnification">
          <P>
            You agree to indemnify, defend, and hold harmless Used Cars Doctor and its operators from and against any claims, liabilities, damages, losses, costs, and expenses (including reasonable legal fees) arising out of or relating to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law; or (d) any content or data you submit through the Service.
          </P>
        </Section>

        <Section title="13. Governing Law & Dispute Resolution">
          <P>
            These Terms shall be governed by and construed in accordance with applicable law. If you are located in the European Economic Area, EU consumer protection laws apply and you may have rights under them that these Terms cannot override.
          </P>
          <P>
            Any disputes arising out of or relating to these Terms or the Service that cannot be resolved informally shall be subject to the exclusive jurisdiction of the courts of competent jurisdiction.
          </P>
          <P>
            EU residents may also use the European Commission's Online Dispute Resolution platform at{' '}
            <a href="https://ec.europa.eu/consumers/odr" style={{ color: '#22d3ee', textDecoration: 'none' }}>ec.europa.eu/consumers/odr</a>.
          </P>
        </Section>

        <Section title="14. Modifications to Terms">
          <P>
            We reserve the right to modify these Terms at any time. Material changes will be communicated by updating the "Last updated" date at the top of this page and, where appropriate, by sending a notification to the email address associated with your account.
          </P>
          <P>
            Your continued use of the Service after the effective date of any revised Terms constitutes your acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Service.
          </P>
        </Section>

        <Section title="15. Contact Us">
          <P>For questions, concerns, or notices regarding these Terms, please contact us:</P>
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
          <Link href="/legal/privacy" style={{ fontSize: 13, color: '#22d3ee', textDecoration: 'none' }}>
            ← {t('legal.privacy.title')}
          </Link>
        </div>
      </main>
    </div>
  )
}
