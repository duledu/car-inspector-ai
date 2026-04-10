'use client'

// =============================================================================
// PWA Bootstrap
// Client component — registers the service worker, detects updates, and renders
// InstallPrompt + UpdatePrompt.
// Also ensures i18next is initialised and applies the stored language preference
// after hydration (SSR always renders with 'en'; client switches to stored lang).
// =============================================================================

import { useEffect, useState, useRef, useCallback } from 'react'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import i18n, { SUPPORTED_LANGS, LS_KEY } from '@/i18n/config'

export function PWAProvider() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingSWRef = useRef<ServiceWorker | null>(null)
  const reloadingRef = useRef(false)

  // Apply stored language preference after hydration.
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

  // Service worker registration + update detection
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    let registration: ServiceWorkerRegistration | null = null
    let cleanupVisibility: (() => void) | null = null

    function markWaiting(sw: ServiceWorker) {
      waitingSWRef.current = sw
      setUpdateReady(true)
    }

    function checkForWaiting(reg: ServiceWorkerRegistration) {
      if (document.visibilityState !== 'visible') return
      reg.update().catch(() => {})
      if (reg.waiting && navigator.serviceWorker.controller) {
        markWaiting(reg.waiting)
      }
    }

    function onUpdateFound() {
      const newSW = registration?.installing
      if (!newSW) return
      newSW.addEventListener('statechange', () => {
        // "installed" + an existing controller = new version waiting to take over
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          markWaiting(newSW)
        }
      })
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        registration = reg

        // Case 1: a new SW is already waiting (e.g. tab was open during deploy)
        if (reg.waiting && navigator.serviceWorker.controller) {
          markWaiting(reg.waiting)
          return
        }

        // Case 2: new SW found during this session
        reg.addEventListener('updatefound', onUpdateFound)

        // Case 3: re-check whenever the tab comes back to foreground
        const handleVisibility = () => checkForWaiting(reg)
        document.addEventListener('visibilitychange', handleVisibility)
        cleanupVisibility = () => document.removeEventListener('visibilitychange', handleVisibility)
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err)
      })

    // When a new SW takes control (after SKIP_WAITING), reload to load fresh assets
    const handleControllerChange = () => {
      if (reloadingRef.current) globalThis.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    return () => {
      cleanupVisibility?.()
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      if (registration) {
        registration.removeEventListener('updatefound', onUpdateFound)
      }
    }
  }, [])

  const handleUpdate = useCallback(() => {
    reloadingRef.current = true
    const sw = waitingSWRef.current
    if (sw) {
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
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
