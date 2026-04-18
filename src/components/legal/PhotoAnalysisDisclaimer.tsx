'use client'

import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

const SERBIAN_PHOTO_ANALYSIS_DISCLAIMER =
  'AI analiza fotografija je isključivo informativnog karaktera i ne garantuje stvarno stanje vozila. Korišćenjem napredne AI tehnologije nastojimo da korisnicima pružimo dodatni uvid i podršku u proceni vozila, ali rezultati mogu biti nepotpuni ili netačni. Na tačnost rezultata mogu uticati brojni faktori, uključujući tip i kvalitet kamere, osvetljenje, ugao snimanja i druge vizuelne uslove. Preporučujemo da sve nalaze uvek potvrdite kod kvalifikovanog stručnjaka pre donošenja konačne odluke o kupovini.'

interface PhotoAnalysisDisclaimerProps {
  style?: CSSProperties
}

export function PhotoAnalysisDisclaimer({ style }: Readonly<PhotoAnalysisDisclaimerProps>) {
  const { i18n, t } = useTranslation()
  const language = (i18n.resolvedLanguage ?? i18n.language ?? '').split('-')[0]
  const disclaimerText =
    language === 'sr'
      ? SERBIAN_PHOTO_ANALYSIS_DISCLAIMER
      : t('disclaimer.photoAnalysis')

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '12px 14px',
        background: 'rgba(245,158,11,0.055)',
        border: '1px solid rgba(245,158,11,0.18)',
        borderRadius: 10,
        ...style,
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: 3 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div
        style={{
          fontSize: 11,
          color: 'rgba(248,250,252,0.78)',
          lineHeight: 1.6,
          overflowWrap: 'anywhere',
        }}
      >
        {disclaimerText}
      </div>
    </div>
  )
}
