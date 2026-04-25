'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useUserStore } from '@/store'

interface DeleteAccountTriggerProps {
  label: string
  fontSize: number
  icon?: React.ReactNode
  className?: string
}

export function DeleteAccountTrigger({ label, fontSize, icon, className }: Readonly<DeleteAccountTriggerProps>) {
  const router = useRouter()
  const { t } = useTranslation()
  const deleteAccount = useUserStore(state => state.deleteAccount)
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) setOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, submitting])

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await deleteAccount()
      router.replace('/auth')
    } catch {
      setError(t('accountDeletion.failed'))
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={['account-delete-link danger-link text-red-500 hover:text-red-400 active:text-red-600 transition-colors duration-150', className].filter(Boolean).join(' ')}
        aria-label={t('accountDeletion.openAria')}
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: icon ? 6 : 0,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize,
          color: 'var(--danger, #ef4444)',
          textDecoration: 'none',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {icon}
        <span style={{ color: 'inherit' }}>
          {label}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            background: 'rgba(2, 6, 12, 0.82)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onClick={() => {
            if (!submitting) setOpen(false)
          }}
        >
          <div
            style={{
              width: 'min(100%, 460px)',
              borderRadius: 18,
              border: '1px solid rgba(239,68,68,0.18)',
              background: 'linear-gradient(180deg, rgba(18,22,32,0.98) 0%, rgba(10,14,24,0.98) 100%)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.03)',
              padding: 24,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                marginBottom: 16,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.24)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" />
                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </div>

            <h2 id="delete-account-title" style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: '#fff' }}>
              {t('accountDeletion.confirmTitle')}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.74)', lineHeight: 1.7 }}>
              {t('accountDeletion.confirmBody')}
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 13, color: '#fca5a5', lineHeight: 1.6 }}>
              {t('accountDeletion.irreversible')}
            </p>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(239,68,68,0.16)',
                  background: 'rgba(239,68,68,0.08)',
                  fontSize: 13,
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                style={{
                  padding: '10px 14px',
                  borderRadius: 11,
                  border: '1px solid rgba(255,255,255,0.09)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.74)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                style={{
                  padding: '10px 16px',
                  borderRadius: 11,
                  border: '1px solid rgba(239,68,68,0.24)',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.75 : 1,
                  boxShadow: '0 8px 22px rgba(239,68,68,0.24)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? t('accountDeletion.deleting') : t('accountDeletion.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
