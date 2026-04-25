'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface AiConsentModalProps {
  readonly onAccept: () => void
}

export function AiConsentModal({ onAccept }: AiConsentModalProps) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  const [checkboxFocused, setCheckboxFocused] = useState(false)
  const checkboxId = 'ai-consent-checkbox'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100dvh',
        padding: '24px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
        background: 'radial-gradient(circle at top, rgba(34,211,238,0.08), transparent 42%), rgba(3, 8, 16, 0.82)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 448,
        borderRadius: 28,
        background: 'linear-gradient(180deg, rgba(14,18,28,0.76) 0%, rgba(7,11,19,0.8) 100%)',
        border: '1px solid rgba(103,232,249,0.18)',
        padding: '28px 22px 22px',
        backdropFilter: 'blur(26px)',
        WebkitBackdropFilter: 'blur(26px)',
        boxShadow: '0 30px 90px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset, 0 0 42px rgba(34,211,238,0.12)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(103,232,249,0.08), transparent 32%, transparent 68%, rgba(129,140,248,0.08))',
          }}
        />

        {/* Icon */}
        <div style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          margin: '0 auto 18px',
          background: 'radial-gradient(circle at 30% 30%, rgba(103,232,249,0.34), rgba(34,211,238,0.12) 45%, rgba(10,18,28,0.4) 100%)',
          border: '1px solid rgba(103,232,249,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(34,211,238,0.05), 0 0 26px rgba(34,211,238,0.16)',
          position: 'relative',
          zIndex: 1,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="#67e8f9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>

        {/* Title */}
        <h2
          id="ai-consent-title"
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
          AI Photo Analysis
        </h2>

        {/* Body */}
        <p style={{
          margin: '0 auto 24px',
          fontSize: 13.5,
          color: 'rgba(255,255,255,0.68)',
          lineHeight: 1.7,
          textAlign: 'center',
          maxWidth: 340,
          position: 'relative',
          zIndex: 1,
        }}>
          {t('inspection.aiConsent.body')}
        </p>

        {/* Checkbox */}
        <label
          htmlFor={checkboxId}
          style={{
          display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer',
          padding: '14px 14px',
          borderRadius: 18,
          background: checked
            ? 'linear-gradient(180deg, rgba(34,211,238,0.1), rgba(34,211,238,0.04))'
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${checked ? 'rgba(103,232,249,0.24)' : 'rgba(255,255,255,0.08)'}`,
          transition: 'background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
          boxShadow: checkboxFocused
            ? '0 0 0 2px rgba(103,232,249,0.42), 0 12px 34px rgba(34,211,238,0.16)'
            : checked
              ? '0 0 0 1px rgba(34,211,238,0.12), 0 10px 30px rgba(34,211,238,0.12)'
              : 'none',
          marginBottom: 20,
          minHeight: 56,
          userSelect: 'none',
          position: 'relative',
          zIndex: 1,
        }}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={checked}
            onChange={e => setChecked(e.target.checked)}
            onFocus={() => setCheckboxFocused(true)}
            onBlur={() => setCheckboxFocused(false)}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 1,
              height: 1,
            }}
          />
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              minWidth: 44,
              borderRadius: 15,
              border: `1.5px solid ${checked ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.22)'}`,
              background: checked ? 'linear-gradient(135deg, rgba(34,211,238,0.95), rgba(129,140,248,0.88))' : 'rgba(255,255,255,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: checked ? '#041018' : 'transparent',
              boxShadow: checked ? '0 0 0 4px rgba(34,211,238,0.12), 0 0 26px rgba(34,211,238,0.26)' : 'inset 0 0 0 1px rgba(255,255,255,0.02)',
              transform: checked ? 'scale(1.03)' : 'scale(1)',
              transition: 'all 180ms ease',
              flexShrink: 0,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                opacity: checked ? 1 : 0,
                transform: checked ? 'scale(1)' : 'scale(0.7)',
                transition: 'opacity 160ms ease, transform 160ms ease',
              }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.84)', lineHeight: 1.55, flex: 1 }}>
            {t('inspection.aiConsent.checkbox')}
          </span>
        </label>

        {/* Confirm button */}
        <button
          type="button"
          onClick={onAccept}
          disabled={!checked}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '14px 0',
            borderRadius: 16,
            border: 'none',
            background: checked
              ? 'linear-gradient(135deg, #22d3ee 0%, #67e8f9 52%, #818cf8 100%)'
              : 'linear-gradient(135deg, rgba(34,211,238,0.16), rgba(103,232,249,0.12))',
            color: checked ? '#041018' : 'rgba(255,255,255,0.3)',
            fontSize: 14, fontWeight: 800,
            fontFamily: 'inherit',
            cursor: checked ? 'pointer' : 'not-allowed',
            transition: 'background 180ms ease, color 180ms ease, transform 180ms ease, box-shadow 180ms ease, opacity 180ms ease',
            letterSpacing: '-0.1px',
            boxShadow: checked ? '0 16px 40px rgba(34,211,238,0.24), 0 0 24px rgba(34,211,238,0.12)' : 'none',
            opacity: checked ? 1 : 0.72,
            transform: checked ? 'translateY(0)' : 'translateY(1px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {t('inspection.aiConsent.confirm')}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ opacity: checked ? 1 : 0.55 }}
          >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  )
}
