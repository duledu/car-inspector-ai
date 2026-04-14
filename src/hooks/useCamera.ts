'use client'

// =============================================================================
// useCamera — production-safe camera hook
//
// Core problem solved:
//   getUserMedia() is async. The <video> element only exists in the DOM AFTER
//   a React render triggered by setMode('camera'). The old code did:
//
//     const stream = await getUserMedia(...)
//     videoRef.current.srcObject = stream   ← videoRef.current is NULL here
//     setMode('camera')                     ← video renders AFTER this
//
//   Result: stream obtained, nothing displayed → black screen.
//
// Fix:
//   1. Caller sets mode='camera' BEFORE calling startCamera(), so the <video>
//      element is in the DOM before getUserMedia resolves.
//   2. Stream is stored in a ref and `attachTick` is bumped. A useEffect keyed
//      on `attachTick` fires AFTER the render, when videoRef.current is valid.
//   3. A requestAnimationFrame delay inside the effect ensures the DOM has
//      fully settled before srcObject is set.
//   4. A 1.5 s safety-net re-attaches the stream if the video still has zero
//      dimensions — this handles the first-permission-grant stall that is
//      common on Android Chrome and iOS Safari in PWA / standalone mode.
// =============================================================================

import { useRef, useState, useEffect, useCallback } from 'react'

export type CameraStatus = 'idle' | 'starting' | 'active' | 'error'

interface UseCameraOptions {
  /** Called when getUserMedia fails (permission denied, no device, etc.) */
  onError?: () => void
}

// ── Module-level helpers (no React nesting) ───────────────────────────────────

/** Resolves after one animation frame so pending renders settle. */
function nextFrame(): Promise<void> {
  return new Promise(resolve => { requestAnimationFrame(() => resolve()) })
}

/** Calls play() and logs the result without throwing. */
async function safePlay(video: HTMLVideoElement, tag: string): Promise<void> {
  try {
    await video.play()
    console.log('[camera] play() OK —', tag)
  } catch (err) {
    console.warn('[camera] play() warning (may be benign) —', tag, err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useCamera({ onError }: UseCameraOptions = {}) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status,     setStatus]     = useState<CameraStatus>('idle')
  /**
   * Incrementing this counter triggers the attach-stream effect.
   * It is bumped after getUserMedia resolves so the effect always runs
   * in a render cycle where the <video> element already exists in the DOM.
   */
  const [attachTick, setAttachTick] = useState(0)

  // ── Attach stream → <video> after every tick ─────────────────────────────
  useEffect(() => {
    if (attachTick === 0) return

    let cancelled  = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    async function run() {
      // Wait one animation frame so any pending mode-change renders settle.
      await nextFrame()
      if (cancelled) return

      const video  = videoRef.current
      const stream = streamRef.current

      if (!video || !stream) {
        console.warn('[camera] attach: video or stream not ready after frame')
        return
      }

      console.log('[camera] attaching stream to <video>')

      // Clear any stale srcObject before assigning the new stream.
      if (video.srcObject !== stream) {
        video.srcObject = null
        video.srcObject = stream
      }

      // play() must come after metadata is available on some browsers.
      // video is typed HTMLVideoElement | null at declaration site; passing it
      // explicitly keeps TypeScript's narrowing intact inside the function.
      async function tryPlay(v: HTMLVideoElement) {
        if (cancelled) return
        await safePlay(v, 'initial')
      }

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        await tryPlay(video)
      } else {
        video.addEventListener('loadedmetadata', () => { void tryPlay(video) }, { once: true })
      }

      // ── Black-screen safety net ──────────────────────────────────────────
      // On Android / iOS PWA, the first-permission-grant can produce a valid
      // MediaStream object whose decoder stalls, leaving the <video> black.
      // If the video has zero dimensions or is paused after 1.5 s, re-attach.
      async function checkBlackScreen() {
        if (cancelled || !videoRef.current || !streamRef.current) return
        const v = videoRef.current
        if (v.videoWidth === 0 || v.paused) {
          console.warn('[camera] black screen detected — re-attaching stream')
          v.srcObject = null
          v.srcObject = streamRef.current
          await safePlay(v, 'black-screen-retry')
        } else {
          console.log('[camera] video OK — dimensions:', v.videoWidth, '×', v.videoHeight)
        }
      }

      retryTimer = setTimeout(() => { void checkBlackScreen() }, 1500)
    }

    run().catch(err => console.error('[camera] attach error:', err))

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [attachTick])

  // ── Stop all active tracks ────────────────────────────────────────────────
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => {
      track.stop()
      console.log('[camera] track stopped:', track.label || track.kind)
    })
    streamRef.current = null
  }, [])

  // ── startCamera ───────────────────────────────────────────────────────────
  /**
   * IMPORTANT: the caller must set mode='camera' BEFORE awaiting this function
   * so the <video> element is in the DOM when the effect fires.
   */
  const startCamera = useCallback(async (facingMode: 'environment' | 'user' = 'environment') => {
    console.log('[camera] startCamera(', facingMode, ')')
    setStatus('starting')
    stopTracks()

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    try {
      console.log('[camera] getUserMedia requesting...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      console.log(
        '[camera] stream obtained — tracks:',
        stream.getTracks().map(t => `${t.kind}/${t.label}`).join(', '),
      )

      streamRef.current = stream
      setStatus('active')
      // Bump tick → useEffect fires after next render with video in DOM
      setAttachTick(n => n + 1)
    } catch (err) {
      console.error('[camera] getUserMedia failed:', err)
      setStatus('error')
      onError?.()
    }
  }, [stopTracks, onError])

  // ── stopCamera ────────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    console.log('[camera] stopCamera()')
    stopTracks()
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStatus('idle')
  }, [stopTracks])

  return { videoRef, streamRef, status, startCamera, stopCamera }
}
