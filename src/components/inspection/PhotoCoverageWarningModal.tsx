'use client'

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface PhotoCoverageWarningModalProps {
  readonly validPhotoCount: number
  readonly onAddMorePhotos: () => void
  readonly onContinueAnyway: () => void
}

/**
 * Shown when the user tries to leave the Photos step with fewer than
 * MIN_PHOTOS_BEFORE_WARNING (3) valid photos. Unlike AiConsentModal, this is
 * a two-way choice — the user is not blocked from continuing, only asked to
 * make an informed, explicit decision. No checkbox: the two buttons already
 * require a deliberate choice, and this isn't legal consent evidence.
 */
export function PhotoCoverageWarningModal({ validPhotoCount, onAddMorePhotos, onContinueAnyway }: PhotoCoverageWarningModalProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-coverage-warning-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '24px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
        background: 'radial-gradient(circle at top, rgba(239,68,68,0.08), transparent 42%), rgba(3, 8, 16, 0.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 448,
        borderRadius: 28,
        background: 'linear-gradient(180deg, rgba(14,18,28,0.76) 0%, rgba(7,11,19,0.8) 100%)',
        border: '1px solid rgba(239,68,68,0.2)',
        padding: '28px 22px 22px',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        boxShadow: '0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 42px rgba(239,68,68,0.1)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.08), transparent 32%, transparent 68%, rgba(245,158,11,0.06))',
          }}
        />

        {/* Icon */}
        <div style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          margin: '0 auto 18px',
          background: 'radial-gradient(circle at 30% 30%, rgba(239,68,68,0.3), rgba(239,68,68,0.1) 45%, rgba(10,18,28,0.4) 100%)',
          border: '1px solid rgba(239,68,68,0.24)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(239,68,68,0.05), 0 0 26px rgba(239,68,68,0.14)',
          position: 'relative',
          zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Title */}
        <h2
          id="photo-coverage-warning-title"
          style={{
            margin: '0 0 12px',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: '-0.4px',
            color: '#fff',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {t('inspection.lowCoverageWarning.title')}
        </h2>

        {/* Body */}
        <p style={{
          margin: '0 auto 20px',
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.68)',
          lineHeight: 1.7,
          textAlign: 'center',
          maxWidth: 360,
          position: 'relative',
          zIndex: 1,
          whiteSpace: 'pre-line',
        }}>
          {t('inspection.lowCoverageWarning.body', { count: validPhotoCount })}
        </p>

        {/* Add more photos — primary action */}
        <button
          type="button"
          onClick={onAddMorePhotos}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '14px 0',
            borderRadius: 16,
            border: 'none',
            background: 'linear-gradient(135deg, #22d3ee 0%, #67e8f9 52%, #818cf8 100%)',
            color: '#041018',
            fontSize: 14, fontWeight: 800,
            fontFamily: 'inherit',
            cursor: 'pointer',
            marginBottom: 10,
            boxShadow: '0 16px 40px rgba(34,211,238,0.2)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {t('inspection.lowCoverageWarning.addMore')}
        </button>

        {/* Continue anyway — ghost/secondary action */}
        <button
          type="button"
          onClick={onContinueAnyway}
          style={{
            width: '100%',
            minHeight: 48,
            padding: '12px 0',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13, fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {t('inspection.lowCoverageWarning.continueAnyway')}
        </button>
      </div>
    </div>
  )
}
