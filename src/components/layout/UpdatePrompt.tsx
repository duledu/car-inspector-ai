'use client'

import { useTranslation } from 'react-i18next'

interface UpdatePromptProps {
  readonly onUpdate: () => void
  readonly onDismiss: () => void
}

export function UpdatePrompt({ onUpdate, onDismiss }: UpdatePromptProps) {
  const { t } = useTranslation()

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9999,
      padding: '12px 16px',
      paddingTop: 'calc(12px + env(safe-area-inset-top))',
      background: 'rgba(8, 12, 20, 0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      animation: 'updateSlideDown 0.3s ease-out',
    }}>
      <style>{`
        @keyframes updateSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Icon */}
      <div style={{
        flexShrink: 0,
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'rgba(34, 211, 238, 0.12)',
        border: '1px solid rgba(34, 211, 238, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#22d3ee',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
          {t('update.title')}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1, lineHeight: 1.3 }}>
          {t('update.subtitle')}
        </div>
      </div>

      {/* Update button */}
      <button
        onClick={onUpdate}
        style={{
          flexShrink: 0,
          padding: '8px 16px',
          background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
          color: '#000',
          border: 'none',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          boxShadow: '0 2px 12px rgba(34,211,238,0.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {t('update.updateNow')}
      </button>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        aria-label={t('update.later')}
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'none',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}
