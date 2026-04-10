'use client'

// =============================================================================
// PWA Bootstrap
// Client component — registers the service worker, detects updates, and renders
// InstallPrompt + UpdatePrompt.
// Also ensures i18next is initialised and applies the stored language preference
// after hydration (SSR always renders with 'en'; client switches to stored lang).
//
// Update detection covers three cases:
//  A) Waiting SW on load    — detected immediately on registration
//  B) SW installs mid-session — detected via updatefound → statechange
//  C) App resumed from background — detected via visibilitychange + reg.update()
//     This case (C) is critical for installed PWA apps which do NOT reload like
//     browser tabs when brought back to the foreground.
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import i18n, { SUPPORTED_LANGS, LS_KEY } from '@/i18n/config'

export function PWAProvider() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingSWRef  = useRef<ServiceWorker | null>(null)
  const reloadingRef  = useRef(false)

  // ── Language hydration ────────────────────────────────────────────────────
  // The server always renders with FALLBACK_LANG ('en') to avoid hydration
  // mismatches. After mount, switch to the user's stored preference.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY)
      if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored) && stored !== i18n.language) {
        i18n.changeLanguage(stored)
      }
    } catch {
      // localStorage blocked (private browsing, etc.) — stay on default
    }
  }, [])

  // ── Service worker registration + update detection ────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    // Held so cleanup can remove listeners added inside .then()
    let removeVisibility: (() => void) | null = null
    let removeUpdateFound: (() => void) | null = null

    // Promote a waiting SW into the update prompt
    function markWaiting(sw: ServiceWorker) {
      waitingSWRef.current = sw
      setUpdateReady(true)
    }

    // Watch a newly-installing SW; when it finishes, show the prompt.
    function watchInstalling(sw: ServiceWorker) {
      sw.addEventListener('statechange', () => {
        // state === 'installed' + existing controller = update ready to take over
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          markWaiting(sw)
        }
      })
    }

    // Force an update check and surface any already-waiting SW.
    // Defined here (useEffect scope, not inside .then) to avoid deep nesting.
    function checkForUpdate(r: ServiceWorkerRegistration) {
      r.update().catch(() => { /* network failure — ignore */ })
      if (r.waiting && navigator.serviceWorker.controller) {
        markWaiting(r.waiting)
      }
    }

    // ── controllerchange: fires when new SW takes control after skipWaiting() ──
    // Only reload if WE triggered the activation (user clicked "Update now").
    // This guard prevents an unwanted reload on first-ever SW install.
    const onControllerChange = () => {
      if (reloadingRef.current) globalThis.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        // ── B) updatefound: new SW installing mid-session ─────────────────────
        // IMPORTANT: register this BEFORE the immediate checks below, so we
        // never miss an update that starts downloading concurrently.
        const onUpdateFound = () => {
          const sw = registration.installing
          if (sw) watchInstalling(sw)
        }
        registration.addEventListener('updatefound', onUpdateFound)
        removeUpdateFound = () => registration.removeEventListener('updatefound', onUpdateFound)

        // ── C) visibilitychange: installed PWA resume from background ─────────
        // Installed PWAs do NOT reload when brought to the foreground — the
        // JavaScript context stays alive. We must explicitly call reg.update()
        // to check for a new sw.js on every resume.
        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') checkForUpdate(registration)
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        removeVisibility = () => document.removeEventListener('visibilitychange', onVisibilityChange)

        // ── A) Immediate: SW already waiting on this load ─────────────────────
        // (e.g. tab was open when deploy happened, or app cold-started after deploy)
        // NOTE: do NOT return early here — all listeners above must stay active
        // for future updates during this session.
        if (registration.waiting && navigator.serviceWorker.controller) {
          markWaiting(registration.waiting)
        }

        // ── Force update check on load ────────────────────────────────────────
        // Belt-and-suspenders: the browser auto-checks on navigation, but for
        // PWA cold starts the timing is not guaranteed. This ensures we always
        // look for a new sw.js the moment the app opens.
        checkForUpdate(registration)
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err)
      })

    return () => {
      removeVisibility?.()
      removeUpdateFound?.()
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  // User clicked "Update now" → tell waiting SW to skip waiting → controllerchange → reload
  const handleUpdate = useCallback(() => {
    reloadingRef.current = true
    const sw = waitingSWRef.current
    if (sw) {
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
      // Fallback: no reference to the waiting SW, just hard-reload
      globalThis.location.reload()
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setUpdateReady(false)
  }, [])

  return (
    <>
      <InstallPrompt />
      {updateReady && <UpdatePrompt onUpdate={handleUpdate} onDismiss={handleDismiss} />}
    </>
  )
}
