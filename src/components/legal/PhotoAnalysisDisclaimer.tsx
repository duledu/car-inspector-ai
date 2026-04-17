'use client'

import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

interface PhotoAnalysisDisclaimerProps {
  style?: CSSProperties
  variant?: 'short' | 'extended'
}

export function PhotoAnalysisDisclaimer({ style, variant = 'short' }: Readonly<PhotoAnalysisDisclaimerProps>) {
  const { t } = useTranslation()
  const key = variant === 'extended' ? 'disclaimer.photoAnalysisExtended' : 'disclaimer.photoAnalysis'

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: variant === 'extended' ? '12px 14px' : '10px 12px',
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
        style={{ flexShrink: 0, marginTop: variant === 'extended' ? 3 : 2 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div
        style={{
          fontSize: variant === 'extended' ? 11 : 11.5,
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.6,
          overflowWrap: 'anywhere',
        }}
      >
        {t(key)}
      </div>
    </div>
  )
}
