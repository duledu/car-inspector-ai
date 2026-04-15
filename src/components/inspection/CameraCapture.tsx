'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCamera } from '@/hooks/useCamera'

interface CameraCaptureProps {
  readonly onCapture: (file: File, previewUrl: string) => void
  readonly onClose: () => void
  readonly label: string
}

function logPhotoFlow(step: string, details?: Record<string, unknown>) {
  console.info(`[inspection/photo-ui] ${step}`, details ?? {})
}

export function CameraCapture({ onCapture, onClose, label }: CameraCaptureProps) {
  const { t } = useTranslation()

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode,         setMode]         = useState<'choose' | 'camera' | 'preview'>('choose')
  const [preview,      setPreview]      = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [facingMode,   setFacingMode]   = useState<'environment' | 'user'>('environment')

  // ── Camera hook ────────────────────────────────────────────────────────────
  // onError: permission denied or device unavailable → fall back to choose mode
  const { videoRef, status, startCamera, stopCamera } = useCamera({
    onError: () => setMode('choose'),
  })

  useEffect(() => {
    const win = window as typeof window & { __uciCameraCaptureActiveCount?: number }
    win.__uciCameraCaptureActiveCount = (win.__uciCameraCaptureActiveCount ?? 0) + 1
    document.body.classList.add('camera-capture-active')
    return () => {
      win.__uciCameraCaptureActiveCount = Math.max(0, (win.__uciCameraCaptureActiveCount ?? 1) - 1)
      if (win.__uciCameraCaptureActiveCount === 0) {
        document.body.classList.remove('camera-capture-active')
      }
    }
  }, [])

  // ── Open camera ────────────────────────────────────────────────────────────
  // setMode('camera') FIRST so the <video> element is rendered in the DOM
  // by the time getUserMedia resolves. startCamera() bumps `attachTick` which
  // fires a useEffect that safely sets srcObject after the render.
  const handleOpenCamera = useCallback(async (facing: 'environment' | 'user') => {
    logPhotoFlow('camera_open_requested', { label, facing })
    setFacingMode(facing)
    setMode('camera')
    await startCamera(facing)
  }, [label, startCamera])

  // ── Capture ────────────────────────────────────────────────────────────────
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    logPhotoFlow('capture_pressed', { label, width: canvas.width, height: canvas.height })
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) {
        logPhotoFlow('capture_blob_failed', { label })
        return
      }
      const file = new File([blob], `${label.replaceAll(/\s+/g, '_')}_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url  = URL.createObjectURL(blob)
      stopCamera()
      setCapturedFile(file)
      setPreview(url)
      setMode('preview')
      logPhotoFlow('preview_opened_from_camera', { label, size: file.size, type: file.type })
    }, 'image/jpeg', 0.88)
  }, [label, stopCamera, videoRef])

  // ── Flip camera ────────────────────────────────────────────────────────────
  const handleFlip = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    // startCamera() handles stopping the previous stream before requesting new one
    startCamera(next)
  }, [facingMode, startCamera])

  // ── Gallery upload ─────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    logPhotoFlow('image_selected', { label, name: file.name, size: file.size, type: file.type })
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setPreview(url)
    setMode('preview')
    logPhotoFlow('preview_opened_from_upload', { label })
    e.target.value = ''
  }, [label])

  // ── Gallery shortcut from camera mode ─────────────────────────────────────
  const handleGalleryFromCamera = useCallback(() => {
    stopCamera()
    setMode('choose')
    // Small delay so the file input is in the DOM after mode switch
    setTimeout(() => fileInputRef.current?.click(), 50)
  }, [stopCamera])

  // ── Confirm / retake ───────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!capturedFile || !preview) return
    logPhotoFlow('confirm_pressed', { label, size: capturedFile.size, type: capturedFile.type })
    onCapture(capturedFile, preview)
  }, [capturedFile, label, preview, onCapture])

  const handleRetake = useCallback(() => {
    logPhotoFlow('retake_pressed', { label })
    setPreview(null)
    setCapturedFile(null)
    setMode('choose')
  }, [label])

  // ── Close ──────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    logPhotoFlow('preview_or_camera_closed', { label, mode })
    stopCamera()
    onClose()
  }, [label, mode, stopCamera, onClose])

  return (
    <div
      data-camera-capture-modal="true"
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#080c14',
        display: 'flex', flexDirection: 'column',
        width: '100vw',
        height: '100dvh',
        minHeight: '100svh',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: mode === 'camera' ? 'none' : 'pan-y',
        WebkitOverflowScrolling: 'touch',
      }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
        background: 'rgba(8,12,20,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <button type="button" onClick={handleClose} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.55)', fontSize: 14, fontFamily: 'var(--font-sans)',
          padding: '6px 0',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {t('common.cancel')}
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{label}</div>
        <div style={{ width: 60 }} />
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: mode === 'preview' ? 'flex-start' : 'center', position: 'relative', overflow: mode === 'preview' ? 'auto' : 'hidden' }}>

        {/* ── CHOOSE MODE ── */}
        {mode === 'choose' && (
          <div style={{ padding: '32px 24px', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div
                style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: t('camera.instruction', { label: `<strong style="color:#22d3ee">${label}</strong>` }) }}
              />
            </div>

            {status === 'error' && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
                {t('camera.cameraUnavailable')}
              </div>
            )}

            <button
              onClick={() => handleOpenCamera('environment')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '18px 24px',
                background: '#22d3ee', color: '#000',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                boxShadow: '0 4px 20px rgba(34,211,238,0.3)',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {t('camera.openCamera')}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px 24px',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {t('camera.chooseFromGallery')}
            </button>
          </div>
        )}

        {/* ── CAMERA MODE ── */}
        {mode === 'camera' && (
          <>
            {/* autoPlay is needed alongside muted+playsInline on mobile */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Loading spinner — shown while stream is initialising */}
            {status === 'starting' && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(8,12,20,0.75)',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: '3px solid rgba(34,211,238,0.15)',
                  borderTopColor: '#22d3ee',
                  animation: 'spin 0.9s linear infinite',
                }} />
              </div>
            )}

            {/* Gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)',
            }} />

            {/* Corner guides */}
            <div style={{ position: 'absolute', top: '12%', right: '10%', bottom: 'calc(128px + env(safe-area-inset-bottom, 0px))', left: '10%', pointerEvents: 'none' }}>
              {([
                { id: 'tl', top: 0,    left:  0, borderTop:    '2px solid #22d3ee', borderLeft:  '2px solid #22d3ee', borderRadius: '4px 0 0 0' },
                { id: 'tr', top: 0,    right: 0, borderTop:    '2px solid #22d3ee', borderRight: '2px solid #22d3ee', borderRadius: '0 4px 0 0' },
                { id: 'bl', bottom: 0, left:  0, borderBottom: '2px solid #22d3ee', borderLeft:  '2px solid #22d3ee', borderRadius: '0 0 0 4px' },
                { id: 'br', bottom: 0, right: 0, borderBottom: '2px solid #22d3ee', borderRight: '2px solid #22d3ee', borderRadius: '0 0 4px 0' },
              ] as (React.CSSProperties & { id: string })[]).map(({ id, ...s }) => (
                <div key={id} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
              ))}
            </div>

            {/* Label overlay */}
            <div style={{
              position: 'absolute', top: 16, left: 0, right: 0,
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <span style={{
                display: 'inline-block', padding: '4px 14px',
                background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)',
                borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#22d3ee',
              }}>
                {label}
              </span>
            </div>

            {/* Camera controls */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '18px 28px',
              paddingBottom: 'calc(22px + env(safe-area-inset-bottom, 0px))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              zIndex: 5,
              background: 'linear-gradient(to top, rgba(5,8,14,0.88) 0%, rgba(5,8,14,0.56) 58%, transparent 100%)',
            }}>
              {/* Gallery shortcut */}
              <button
                onClick={handleGalleryFromCamera}
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>

              {/* Shutter — disabled until stream is active */}
              <button
                onClick={handleCapture}
                disabled={status !== 'active'}
                className="camera-btn"
                style={{
                  width: 78, height: 78, borderRadius: '50%',
                  background: status === 'active' ? '#fff' : 'rgba(255,255,255,0.25)',
                  border: '4px solid rgba(255,255,255,0.3)',
                  cursor: status === 'active' ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: status === 'active' ? '0 0 0 2px rgba(34,211,238,0.6)' : 'none',
                  flexShrink: 0,
                  transition: 'background 0.2s, box-shadow 0.2s',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: status === 'active' ? '#fff' : 'rgba(255,255,255,0.25)',
                }} />
              </button>

              {/* Flip camera */}
              <button
                onClick={handleFlip}
                style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
              </button>
            </div>
          </>
        )}

        {/* ── PREVIEW MODE ── */}
        {mode === 'preview' && preview && (
          <div style={{ width: '100%', minHeight: 'calc(100dvh - 57px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: '1 1 auto', minHeight: 320, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={label}
                style={{ width: '100%', maxHeight: 'calc(100svh - 210px)', objectFit: 'contain', background: '#000' }}
              />
              <div style={{ position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px',
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#22c55e',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {t('camera.photoCaptured')}
                </span>
              </div>
            </div>

            <div style={{
              padding: '20px 24px',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(8,12,20,0.97)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: 12,
              position: 'sticky',
              bottom: 0,
              zIndex: 2,
            }}>
              <button
                onClick={handleRetake}
                style={{
                  flex: 1, padding: '14px',
                  background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {t('camera.retake')}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 2, padding: '14px',
                  background: '#22d3ee', color: '#000',
                  border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: '0 4px 16px rgba(34,211,238,0.3)',
                }}
              >
                {t('camera.usePhoto')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Single file input — always rendered so the ref is always valid */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}
