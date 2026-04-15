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

const SW_URL = '/sw.js'
const SW_SCOPE = '/'
const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000
const RELOAD_FALLBACK_MS = 4_000

function getBuildIdFromText(text: string): string | null {
  return (
    text.match(/"buildId"\s*:\s*"([^"]+)"/)?.[1] ??
    text.match(/buildId\\?":\\?"([^"\\]+)\\?"/)?.[1] ??
    null
  )
}

function getCurrentBuildId(): string | null {
  const nextData = document.getElementById('__NEXT_DATA__')?.textContent
  if (nextData) {
    try {
      const parsed = JSON.parse(nextData) as { buildId?: unknown }
      if (typeof parsed.buildId === 'string' && parsed.buildId) return parsed.buildId
    } catch {
      const id = getBuildIdFromText(nextData)
      if (id) return id
    }
  }

  return getBuildIdFromText(document.documentElement.innerHTML)
}

function isSupportedServiceWorkerState(state: ServiceWorkerState): boolean {
  return state === 'installed' || state === 'activating' || state === 'activated'
}

export function PWAProvider() {
  const [updateReady, setUpdateReady] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const waitingSWRef = useRef<ServiceWorker | null>(null)
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const reloadingRef = useRef(false)
  const reloadTriggeredRef = useRef(false)
  const dismissedWorkerRef = useRef<ServiceWorker | null>(null)
  const reloadOnlyUpdateRef = useRef(false)
  const pendingBuildIdRef = useRef<string | null>(null)
  const dismissedBuildIdRef = useRef<string | null>(null)

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
      // localStorage blocked (private browsing, etc.) - stay on cookie/default.
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return

    let disposed = false
    let removeVisibility: (() => void) | null = null
    let removeUpdateFound: (() => void) | null = null
    let removeFocus: (() => void) | null = null
    let removeOnline: (() => void) | null = null
    let removePageShow: (() => void) | null = null
    let intervalId: ReturnType<typeof setInterval> | null = null

    function markWaiting(sw: ServiceWorker) {
      if (disposed || dismissedWorkerRef.current === sw) return
      waitingSWRef.current = sw
      reloadOnlyUpdateRef.current = false
      pendingBuildIdRef.current = null
      setUpdateReady(true)
    }

    function markReloadOnlyUpdate(buildId: string) {
      if (disposed || dismissedBuildIdRef.current === buildId) return
      pendingBuildIdRef.current = buildId
      reloadOnlyUpdateRef.current = true
      setUpdateReady(true)
    }

    function inspectRegistration(registration: ServiceWorkerRegistration) {
      registrationRef.current = registration

      if (registration.waiting && navigator.serviceWorker.controller) {
        markWaiting(registration.waiting)
        return
      }

      const installing = registration.installing
      if (installing) {
        watchInstalling(installing)
      }
    }

    function watchInstalling(sw: ServiceWorker) {
      if (sw.state === 'installed' && navigator.serviceWorker.controller) {
        markWaiting(sw)
        return
      }

      const onStateChange = () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          markWaiting(sw)
          sw.removeEventListener('statechange', onStateChange)
        }
      }
      sw.addEventListener('statechange', onStateChange)
    }

    async function checkForUpdate(reason: string) {
      if (disposed) return

      try {
        const registration =
          registrationRef.current ??
          (await navigator.serviceWorker.ready) ??
          (await navigator.serviceWorker.getRegistration(SW_SCOPE))

        if (!registration) return
        inspectRegistration(registration)

        const updatedRegistration = await registration.update()
        console.info('[PWA] update check complete', { reason })
        inspectRegistration(updatedRegistration)
      } catch (err) {
        console.warn('[PWA] update check failed', {
          reason,
          message: err instanceof Error ? err.message : String(err),
        })
      }

      await checkForBuildUpdate(reason)
    }

    async function checkForBuildUpdate(reason: string) {
      if (disposed || waitingSWRef.current) return

      const currentBuildId = getCurrentBuildId()
      if (!currentBuildId) return

      try {
        const response = await fetch(`/?__pwa_build_check=${Date.now()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'text/html' },
        })
        if (!response.ok) return

        const html = await response.text()
        const remoteBuildId = getBuildIdFromText(html)
        if (remoteBuildId && remoteBuildId !== currentBuildId) {
          console.info('[PWA] build update detected', { reason, currentBuildId, remoteBuildId })
          markReloadOnlyUpdate(remoteBuildId)
        }
      } catch (err) {
        console.warn('[PWA] build update check failed', {
          reason,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const onControllerChange = () => {
      if (reloadingRef.current) {
        reloadOnce()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register(SW_URL, { scope: SW_SCOPE, updateViaCache: 'none' })
      .then((registration) => {
        if (disposed) return
        registrationRef.current = registration

        const onUpdateFound = () => {
          const sw = registration.installing
          if (sw) watchInstalling(sw)
        }
        registration.addEventListener('updatefound', onUpdateFound)
        removeUpdateFound = () => registration.removeEventListener('updatefound', onUpdateFound)

        const onVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
            void checkForUpdate('visibilitychange')
          }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        removeVisibility = () => document.removeEventListener('visibilitychange', onVisibilityChange)

        const onFocus = () => void checkForUpdate('focus')
        window.addEventListener('focus', onFocus)
        removeFocus = () => window.removeEventListener('focus', onFocus)

        const onOnline = () => void checkForUpdate('online')
        window.addEventListener('online', onOnline)
        removeOnline = () => window.removeEventListener('online', onOnline)

        const onPageShow = () => void checkForUpdate('pageshow')
        window.addEventListener('pageshow', onPageShow)
        removePageShow = () => window.removeEventListener('pageshow', onPageShow)

        intervalId = setInterval(() => {
          if (document.visibilityState === 'visible') {
            void checkForUpdate('interval')
          }
        }, UPDATE_CHECK_INTERVAL_MS)

        inspectRegistration(registration)
        void navigator.serviceWorker.ready.then(inspectRegistration).catch(() => undefined)
        void checkForUpdate('registered')
      })
      .catch((err) => {
        console.warn('[PWA] SW registration failed:', err)
      })

    return () => {
      disposed = true
      removeVisibility?.()
      removeUpdateFound?.()
      removeFocus?.()
      removeOnline?.()
      removePageShow?.()
      if (intervalId) clearInterval(intervalId)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [reloadOnce])

  const handleUpdate = useCallback(async () => {
    if (reloadingRef.current) return
    reloadingRef.current = true
    setIsUpdating(true)

    let sw = waitingSWRef.current

    if ('serviceWorker' in navigator) {
      try {
        const registration =
          registrationRef.current ??
          (await navigator.serviceWorker.getRegistration(SW_SCOPE)) ??
          null

        if (registration) {
          registrationRef.current = registration
          sw = registration.waiting ?? sw

          if (!sw) {
            const updatedRegistration = await registration.update()
            registrationRef.current = updatedRegistration
            sw = updatedRegistration.waiting ?? updatedRegistration.installing ?? sw
          }
        }
      } catch (err) {
        console.warn('[PWA] update activation lookup failed', err)
      }
    }

    if (sw && isSupportedServiceWorkerState(sw.state) && !reloadOnlyUpdateRef.current) {
      sw.postMessage({ type: 'SKIP_WAITING' })
      globalThis.setTimeout(() => {
        if (reloadingRef.current) reloadOnce()
      }, RELOAD_FALLBACK_MS)
      return
    }

    reloadOnce()
  }, [reloadOnce])

  const handleDismiss = useCallback(() => {
    dismissedWorkerRef.current = waitingSWRef.current
    dismissedBuildIdRef.current = pendingBuildIdRef.current
    reloadOnlyUpdateRef.current = false
    setUpdateReady(false)
  }, [])

  return (
    <>
      <InstallPrompt />
      {updateReady && (
        <UpdatePrompt
          isUpdating={isUpdating}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
