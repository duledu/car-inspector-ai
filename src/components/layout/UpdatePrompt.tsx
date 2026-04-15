'use client'

import { useTranslation } from 'react-i18next'

interface UpdatePromptProps {
  readonly onUpdate: () => void | Promise<void>
  readonly onDismiss: () => void
  readonly isUpdating?: boolean
}

export function UpdatePrompt({ onUpdate, onDismiss, isUpdating = false }: UpdatePromptProps) {
  const { t } = useTranslation()

  return (
    <div className="update-prompt" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10000,
      padding: '12px max(16px, env(safe-area-inset-right, 0px)) 12px max(16px, env(safe-area-inset-left, 0px))',
      paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
      background: 'rgba(8, 12, 20, 0.92)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(34, 211, 238, 0.2)',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      animation: 'updateSlideDown 0.3s ease-out',
      pointerEvents: 'auto',
    }}>
      <style>{`
        @keyframes updateSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (max-width: 430px) {
          .update-prompt {
            flex-wrap: wrap;
          }
          .update-prompt__text {
            flex-basis: calc(100% - 48px);
          }
          .update-prompt__actions {
            width: 100%;
            justify-content: flex-end;
          }
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
      <div className="update-prompt__text" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
          {t('update.title')}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1, lineHeight: 1.3 }}>
          {t('update.subtitle')}
        </div>
      </div>

      <div className="update-prompt__actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Update button */}
        <button
          type="button"
          onClick={onUpdate}
          disabled={isUpdating}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
            color: '#000',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: isUpdating ? 'wait' : 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: '0 2px 12px rgba(34,211,238,0.35)',
            whiteSpace: 'nowrap',
            opacity: isUpdating ? 0.78 : 1,
          }}
        >
          {t('update.updateNow')}
        </button>

        {/* Dismiss */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('update.later')}
          style={{
            flexShrink: 0,
            width: 32,
            height: 44,
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
    </div>
  )
}
