'use client'

// =============================================================================
// InstallPrompt - existing PWA install UI (Android/Chrome + iOS Safari)
//
// Behavior:
//   - Captures `beforeinstallprompt` at module level so hydration timing
//     does not cause the event to be missed.
//   - Uses native install flow on browsers that expose the event.
//   - Uses iOS Safari Add to Home Screen instructions as a fallback.
//   - Dismissal uses a cooldown so the prompt can return later.
//   - After successful install, never shown again.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  prompt(): Promise<void>
}

type Variant = 'hidden' | 'android' | 'ios'

const INSTALL_KEY = 'pwa_installed'
const DISMISS_UNTIL_KEY = 'pwa_prompt_dismissed_until'
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000

let earlyPrompt: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  const onEarlyPrompt = (e: Event) => {
    e.preventDefault()
    earlyPrompt = e as BeforeInstallPromptEvent
    window.removeEventListener('beforeinstallprompt', onEarlyPrompt)
  }

  window.addEventListener('beforeinstallprompt', onEarlyPrompt)
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false

  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function detectSafariOnIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return detectIOS() && /Safari/i.test(ua) && !/(CriOS|FxiOS|EdgiOS|OPiOS|OPT|YaBrowser)/i.test(ua)
}

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /android|iphone|ipad|ipod|mobile/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

function getDismissedUntil(): number {
  try {
    const value = localStorage.getItem(DISMISS_UNTIL_KEY)
    const parsed = value ? Number.parseInt(value, 10) : 0
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function hasDismissCooldown(): boolean {
  return getDismissedUntil() > Date.now()
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + DISMISS_COOLDOWN_MS))
  } catch {
    // Ignore storage failures such as private browsing restrictions.
  }
}

function markInstalled(): void {
  try {
    localStorage.setItem(INSTALL_KEY, '1')
    localStorage.removeItem(DISMISS_UNTIL_KEY)
  } catch {
    // Ignore storage failures.
  }
}

function alreadyInstalled(): boolean {
  if (isStandalone()) return true

  try {
    return localStorage.getItem(INSTALL_KEY) === '1'
  } catch {
    return false
  }
}

export function InstallPrompt({ routeKey }: Readonly<{ routeKey?: string }>) {
  const [variant, setVariant] = useState<Variant>('hidden')
  const [installing, setInstalling] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(earlyPrompt)
  const shownRef = useRef(false)

  const show = useCallback((nextVariant: Variant) => {
    if (shownRef.current) return
    if (!isMobileDevice() || alreadyInstalled() || hasDismissCooldown()) return

    shownRef.current = true
    setVariant(nextVariant)
  }, [])

  const dismiss = useCallback(() => {
    markDismissed()
    setVariant('hidden')
  }, [])

  useEffect(() => {
    if (variant === 'hidden') {
      shownRef.current = false
    }
  }, [routeKey, variant])

  useEffect(() => {
    if (!isMobileDevice() || alreadyInstalled() || hasDismissCooldown()) return

    const iosSafari = detectSafariOnIOS()

    const onInstalled = () => {
      markInstalled()
      setVariant('hidden')
    }

    window.addEventListener('appinstalled', onInstalled)

    if (iosSafari) {
      const timer = setTimeout(() => show('ios'), 4000)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('appinstalled', onInstalled)
      }
    }

    let scheduleTimer: ReturnType<typeof setTimeout> | null = null
    let removeScrollListener: (() => void) | null = null

    function scheduleShow() {
      if (shownRef.current || alreadyInstalled() || hasDismissCooldown()) return

      scheduleTimer = setTimeout(() => show('android'), 4000)

      const onScroll = () => {
        if (scheduleTimer) clearTimeout(scheduleTimer)
        show('android')
      }

      window.addEventListener('scroll', onScroll, { once: true, passive: true })
      removeScrollListener = () => window.removeEventListener('scroll', onScroll)
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      earlyPrompt = e as BeforeInstallPromptEvent
      scheduleShow()
    }

    if (promptRef.current) {
      scheduleShow()
    } else {
      window.addEventListener('beforeinstallprompt', onPrompt)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      removeScrollListener?.()
      if (scheduleTimer) clearTimeout(scheduleTimer)
    }
  }, [show, routeKey])

  const handleInstall = useCallback(async () => {
    const prompt = promptRef.current
    if (!prompt) return

    setInstalling(true)

    try {
      await prompt.prompt()
      const { outcome } = await prompt.userChoice

      if (outcome === 'accepted') {
        markInstalled()
      } else {
        markDismissed()
      }
    } finally {
      promptRef.current = null
      earlyPrompt = null
      setInstalling(false)
      setVariant('hidden')
    }
  }, [])

  if (variant === 'hidden') return null
  if (variant === 'ios') return <IOSSheet onDismiss={dismiss} />

  return <AndroidBanner onInstall={handleInstall} onDismiss={dismiss} installing={installing} />
}

interface AndroidBannerProps {
  onInstall: () => void
  onDismiss: () => void
  installing: boolean
}

function AndroidBanner({ onInstall, onDismiss, installing }: Readonly<AndroidBannerProps>) {
  const { t } = useTranslation()

  return (
    <>
      <div
        onClick={onDismiss}
        style={{ position: 'fixed', inset: 0, zIndex: 8998, background: 'transparent' }}
      />

      <div
        role="dialog"
        aria-label="Install app"
        style={{
          position: 'fixed',
          bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 24px)',
          maxWidth: 480,
          zIndex: 8999,
          background: 'rgba(10, 15, 26, 0.97)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          border: '1px solid rgba(34, 211, 238, 0.18)',
          borderRadius: 20,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxSizing: 'border-box',
          boxShadow:
            '0 0 0 1px rgba(255,255,255,0.04), 0 8px 48px rgba(0,0,0,0.64), 0 0 32px rgba(34,211,238,0.08)',
          animation: 'pwa-slide-up 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        <div style={{
          flexShrink: 0,
          width: 48,
          height: 48,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.10)',
          background: '#080c14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/favicon_used_cars_doctor.png"
            alt="App icon"
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 12 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: '#f1f5f9',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}>
            {t('pwa.addToHome')}
          </p>
          <p style={{
            margin: '3px 0 0',
            fontSize: 12,
            color: 'rgba(241,245,249,0.45)',
            lineHeight: 1.4,
          }}>
            {t('pwa.instantAccess')}
          </p>
        </div>

        <button
          onClick={onInstall}
          disabled={installing}
          aria-label="Install app"
          style={{
            flexShrink: 0,
            height: 36,
            padding: '0 16px',
            borderRadius: 10,
            border: 'none',
            background: installing
              ? 'rgba(34,211,238,0.12)'
              : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            color: installing ? 'rgba(34,211,238,0.5)' : '#050810',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            cursor: installing ? 'default' : 'pointer',
            transition: 'opacity 0.15s ease, transform 0.15s ease',
            fontFamily: 'var(--font-sans)',
            boxShadow: installing ? 'none' : '0 4px 16px rgba(34,211,238,0.3)',
          }}
        >
          {installing ? '...' : t('pwa.install')}
        </button>

        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(241,245,249,0.4)',
            fontSize: 16,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'background 0.15s, color 0.15s',
            fontFamily: 'var(--font-sans)',
          }}
        >
          X
        </button>
      </div>

      <style>{`
        @keyframes pwa-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)     scale(1);    }
        }
      `}</style>
    </>
  )
}

function IOSSheet({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  const { t } = useTranslation()

  return (
    <>
      <div
        onClick={onDismiss}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 8998,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'pwa-fade-in 0.25s ease both',
        }}
      />

      <div
        role="dialog"
        aria-label="Add to Home Screen instructions"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 8999,
          background: 'rgba(10, 15, 26, 0.99)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderTop: '1px solid rgba(34,211,238,0.16)',
          borderRadius: '24px 24px 0 0',
          padding: 'clamp(24px, 5vw, 32px)',
          paddingBottom: 'calc(clamp(24px, 5vw, 32px) + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
          animation: 'pwa-sheet-up 0.35s cubic-bezier(0.34,1.22,0.64,1) both',
          maxWidth: 560,
          margin: '0 auto',
        }}
      >
        <div style={{
          width: 36,
          height: 4,
          borderRadius: 99,
          background: 'rgba(255,255,255,0.12)',
          margin: '-8px auto 20px',
        }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/favicon_used_cars_doctor.png"
              alt=""
              width={40}
              height={40}
              style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}
            />
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
                {t('pwa.installTitle')}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(241,245,249,0.45)' }}>
                {t('pwa.installSub')}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            aria-label="Close"
            style={{
              width: 30,
              height: 30,
              borderRadius: 99,
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(241,245,249,0.4)',
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-sans)',
            }}
          >
            X
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <IOSStep number={1} icon={<ShareIcon />} label={<span dangerouslySetInnerHTML={{ __html: t('pwa.iosStep1') }} />} />
          <IOSStep number={2} icon={<AddIcon />} label={<span dangerouslySetInnerHTML={{ __html: t('pwa.iosStep2') }} />} />
          <IOSStep number={3} icon={<CheckIcon />} label={<span dangerouslySetInnerHTML={{ __html: t('pwa.iosStep3') }} />} />
        </div>

        <button
          onClick={onDismiss}
          style={{
            marginTop: 24,
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.04)',
            color: 'rgba(241,245,249,0.5)',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background 0.15s',
          }}
        >
          {t('pwa.maybeLater')}
        </button>
      </div>

      <style>{`
        @keyframes pwa-fade-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pwa-sheet-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </>
  )
}

function IOSStep({ number, icon, label }: Readonly<{
  number: number
  icon: React.ReactNode
  label: React.ReactNode
}>) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 14px',
      borderRadius: 14,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: 99,
        background: 'rgba(34,211,238,0.12)',
        border: '1px solid rgba(34,211,238,0.22)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#22d3ee',
      }}>
        {number}
      </div>
      <div style={{ flexShrink: 0, color: '#22d3ee', display: 'flex', alignItems: 'center' }}>
        {icon}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: 'rgba(241,245,249,0.75)', lineHeight: 1.45 }}>
        {label}
      </p>
    </div>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  )
}

function AddIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
