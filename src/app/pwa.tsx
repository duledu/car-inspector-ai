'use client'

// =============================================================================
// PWA Bootstrap
// Registers the service worker, detects updates, and renders install/update UI.
// Also keeps i18next aligned with the persisted cookie language.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import { InstallPrompt } from '@/components/layout/InstallPrompt'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import i18n from '@/i18n/config'
import { LANG_COOKIE, LS_KEY, isSupportedLang } from '@/i18n/shared'

export function PWAProvider() {
  const [updateReady, setUpdateReady] = useState(false)
  const waitingSWRef = useRef<ServiceWorker | null>(null)
  const reloadingRef = useRef(false)
  const reloadTriggeredRef = useRef(false)

  const reloadOnce = useCallback(() => {
    if (reloadTriggeredRef.current) return
    reloadTriggeredRef.current = true
    globalThis.location.reload()
  }, [])

  // Migrate old localStorage language preferences into the cookie source of
  // truth. The next SSR request can then render with the same language.
  useEffect(() => {
    try {
      const hasCookie = document.cookie
        .split('; ')
        .some(row => row.startsWith(`${LANG_COOKIE}=`))
      if (hasCookie) return

      const stored = localStorage.getItem(LS_KEY)
      if (isSupportedLang(stored)) {
        document.cookie = `${LANG_COOKIE}=${encodeURIComponent(stored)}; Path=/; Max-Age=31536000; SameSite=Lax`
        i18n.changeLanguage(stored)
      }
    } catch {
      // localStorage blocked (private browsing, etc.) - stay on cookie/default
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    let removeVisibility: (() => void) | null = null
    let removeUpdateFound: (() => void) | null = null

    function markWaiting(sw: ServiceWorker) {
      waitingSWRef.current = sw
      setUpdateReady(true)
    }

    function watchInstalling(sw: ServiceWorker) {
      sw.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          markWaiting(sw)
        }
      })
    }

    function checkForUpdate(registration: ServiceWorkerRegistration) {
      registration.update().catch(() => undefined)
      if (registration.waiting && navigator.serviceWorker.controller) {
        markWaiting(registration.waiting)
      }
    }

    const onControllerChange = () => {
      if (reloadingRef.current) reloadOnce()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const onUpdateFound = () => {
          const sw = registration.installing
          if (sw) watchInstalling(sw)
        }
        registration.addEventListener('updatefound', onUpdateFound)
        removeUpdateFound = () => registration.removeEventListener('updatefound', onUpdateFound)

        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') checkForUpdate(registration)
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        removeVisibility = () => document.removeEventListener('visibilitychange', onVisibilityChange)

        if (registration.waiting && navigator.serviceWorker.controller) {
          markWaiting(registration.waiting)
        }

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
  }, [reloadOnce])

  const handleUpdate = useCallback(async () => {
    if (reloadingRef.current) return
    reloadingRef.current = true

    let sw: ServiceWorker | null = null
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/')
      sw = registration?.waiting ?? null

      if (!sw && registration) {
        try {
          const updatedRegistration = await registration.update()
          sw = updatedRegistration.waiting ?? null
        } catch {
          // Fall back to a normal reload below.
        }
      }
    }

    if (!sw && waitingSWRef.current?.state === 'installed') {
      sw = waitingSWRef.current
    }

    if (sw) {
      sw.postMessage({ type: 'SKIP_WAITING' })
    } else {
      reloadOnce()
    }
  }, [reloadOnce])

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
