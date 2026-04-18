'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useCamera } from '@/hooks/useCamera'

interface CameraCaptureProps {
  readonly onCapture: (file: File, previewUrl: string) => void
  readonly onClose: () => void
  readonly label: string
  readonly angleKey?: string
  readonly shotNumber?: number
  readonly totalShots?: number
  readonly allAngles?: ReadonlyArray<{ key: string }>
  readonly completedKeys?: ReadonlyArray<string>
}

type QualityResult = 'good' | 'dark' | 'bright'

function logPhotoFlow(step: string, details?: Record<string, unknown>) {
  console.info(`[inspection/photo-ui] ${step}`, details ?? {})
}

// Centre-crop brightness check — fast, reliable for dark/bright detection
function analyzeImageQuality(canvas: HTMLCanvasElement): QualityResult {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'good'
  const { width, height } = canvas
  const sw = Math.min(128, width)
  const sh = Math.min(128, height)
  const sx = (width - sw) >> 1
  const sy = (height - sh) >> 1
  const { data } = ctx.getImageData(sx, sy, sw, sh)
  let sum = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  const avg = sum / pixels
  if (avg < 38) return 'dark'
  if (avg > 222) return 'bright'
  return 'good'
}

// Progress strip — completed=green, current=cyan+taller, upcoming=dim
function ShotProgressStrip({
  allAngles,
  currentKey,
  completedKeys,
}: {
  allAngles: ReadonlyArray<{ key: string }>
  currentKey?: string
  completedKeys?: ReadonlyArray<string>
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
      {allAngles.map(({ key }) => {
        const isDone    = completedKeys?.includes(key) && key !== currentKey
        const isCurrent = key === currentKey
        return (
          <div
            key={key}
            style={{
              height: isCurrent ? 5 : 3,
              width: isCurrent ? 22 : 12,
              borderRadius: 3,
              background: isDone
                ? 'rgba(34,197,94,0.65)'
                : isCurrent
                ? '#22d3ee'
                : 'rgba(255,255,255,0.11)',
              boxShadow: isCurrent ? '0 0 8px rgba(34,211,238,0.6)' : 'none',
              transition: 'width 0.25s ease, height 0.25s ease, background 0.25s ease, box-shadow 0.25s ease',
              flexShrink: 0,
            }}
          />
        )
      })}
    </div>
  )
}

export function CameraCapture({
  onCapture,
  onClose,
  label,
  angleKey,
  shotNumber,
  totalShots,
  allAngles,
  completedKeys,
}: CameraCaptureProps) {
  const { t } = useTranslation()

  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode,          setMode]          = useState<'choose' | 'camera' | 'preview'>('choose')
  const [preview,       setPreview]       = useState<string | null>(null)
  const [capturedFile,  setCapturedFile]  = useState<File | null>(null)
  const [facingMode,    setFacingMode]    = useState<'environment' | 'user'>('environment')
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null)
  const [captureFlash,  setCaptureFlash]  = useState(false)
  const [titleVisible,  setTitleVisible]  = useState(false)

  const { videoRef, status, startCamera, stopCamera } = useCamera({
    onError: () => setMode('choose'),
  })

  useEffect(() => {
    const win = window as typeof window & { __uciCameraCaptureActiveCount?: number }
    win.__uciCameraCaptureActiveCount = (win.__uciCameraCaptureActiveCount ?? 0) + 1
    document.body.classList.add('camera-capture-active')
    // Fade in title on mount
    const tid = setTimeout(() => setTitleVisible(true), 40)
    return () => {
      clearTimeout(tid)
      win.__uciCameraCaptureActiveCount = Math.max(0, (win.__uciCameraCaptureActiveCount ?? 1) - 1)
      if (win.__uciCameraCaptureActiveCount === 0) document.body.classList.remove('camera-capture-active')
    }
  }, [])

  const handleOpenCamera = useCallback(async (facing: 'environment' | 'user') => {
    logPhotoFlow('camera_open_requested', { label, facing })
    setFacingMode(facing)
    setMode('camera')
    await startCamera(facing)
  }, [label, startCamera])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    logPhotoFlow('capture_pressed', { label, width: canvas.width, height: canvas.height })
    canvas.getContext('2d')?.drawImage(video, 0, 0)

    // Brief white flash feedback
    setCaptureFlash(true)
    setTimeout(() => setCaptureFlash(false), 380)

    canvas.toBlob(blob => {
      if (!blob) { logPhotoFlow('capture_blob_failed', { label }); return }
      const quality = analyzeImageQuality(canvas)
      const file = new File([blob], `${label.replaceAll(/\s+/g, '_')}_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url  = URL.createObjectURL(blob)
      stopCamera()
      setCapturedFile(file)
      setPreview(url)
      setQualityResult(quality)
      setMode('preview')
      logPhotoFlow('preview_opened_from_camera', { label, size: file.size, type: file.type, quality })
    }, 'image/jpeg', 0.88)
  }, [label, stopCamera, videoRef])

  const handleFlip = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    startCamera(next)
  }, [facingMode, startCamera])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    logPhotoFlow('image_selected', { label, name: file.name, size: file.size, type: file.type })
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setPreview(url)
    setQualityResult('good') // gallery picks can't be analysed without canvas
    setMode('preview')
    logPhotoFlow('preview_opened_from_upload', { label })
    e.target.value = ''
  }, [label])

  const handleGalleryFromCamera = useCallback(() => {
    stopCamera()
    setMode('choose')
    setTimeout(() => fileInputRef.current?.click(), 50)
  }, [stopCamera])

  const handleConfirm = useCallback(() => {
    if (!capturedFile || !preview) return
    logPhotoFlow('confirm_pressed', { label, size: capturedFile.size, type: capturedFile.type })
    onCapture(capturedFile, preview)
  }, [capturedFile, label, preview, onCapture])

  const handleRetake = useCallback(() => {
    logPhotoFlow('retake_pressed', { label })
    setPreview(null)
    setCapturedFile(null)
    setQualityResult(null)
    setMode('choose')
  }, [label])

  const handleClose = useCallback(() => {
    logPhotoFlow('preview_or_camera_closed', { label, mode })
    stopCamera()
    onClose()
  }, [label, mode, stopCamera, onClose])

  // Translated display name
  const translatedLabel = angleKey
    ? t(`angle.${angleKey}`, { defaultValue: label })
    : label

  // Per-angle detailed guide text (shown in choose card and camera overlay)
  const guideText = t(
    angleKey ? `camera.guide.${angleKey}` : 'camera.guide.default',
    { defaultValue: t('camera.guide.default') }
  )

  // Short contextual hint (shown in header under the title)
  const contextHint = angleKey
    ? t(`camera.hint.${angleKey}`, { defaultValue: '' })
    : ''

  const showProgress = !!(allAngles && allAngles.length > 1 && shotNumber && totalShots)

  // Quality UI helpers
  const qualityIsPoor = qualityResult === 'dark' || qualityResult === 'bright'
  const qualityLabel  = qualityResult === 'good'
    ? t('camera.qualityGood')
    : qualityResult === 'dark'
    ? t('camera.qualityDark')
    : qualityResult === 'bright'
    ? t('camera.qualityBright')
    : null

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

      {/* ── Header (choose + preview only — camera uses a floating overlay) ──── */}
      {mode !== 'camera' && <div style={{
        background: 'rgba(8,12,20,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        flexShrink: 0,
        zIndex: 10,
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
      }}>
        {/* Top row: cancel · title + step · spacer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 16px 10px',
        }}>
          <button type="button" onClick={handleClose} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: 13.5, fontFamily: 'var(--font-sans)',
            padding: '6px 0', letterSpacing: '-0.1px',
            WebkitTapHighlightColor: 'transparent',
            flexShrink: 0,
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            {t('common.cancel')}
          </button>

          {/* Centre: angle name + step + short hint */}
          <div style={{
            textAlign: 'center', flex: 1, padding: '0 12px',
            opacity: titleVisible ? 1 : 0,
            transform: titleVisible ? 'translateY(0)' : 'translateY(4px)',
            transition: 'opacity 0.22s ease, transform 0.22s ease',
          }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: '#fff',
              letterSpacing: '-0.3px',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {translatedLabel}
            </div>
            {shotNumber && totalShots && (
              <div style={{
                fontSize: 10, fontWeight: 500,
                color: 'rgba(255,255,255,0.38)',
                marginTop: 1, letterSpacing: '0.02em',
              }}>
                {t('camera.shotOf', { number: shotNumber, total: totalShots })}
              </div>
            )}
            {/* Short contextual hint — choose mode only; camera mode shows it in overlay */}
            {contextHint && mode === 'choose' && (
              <div style={{
                fontSize: 10.5, fontWeight: 500,
                color: 'rgba(34,211,238,0.65)',
                marginTop: 2, letterSpacing: '-0.1px',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {contextHint}
              </div>
            )}
          </div>

          {/* Right spacer — mirrors cancel button width */}
          <div style={{ flexShrink: 0, width: 60 }} />
        </div>

        {/* Progress strip */}
        {showProgress && (
          <div style={{ padding: '0 20px 10px' }}>
            <ShotProgressStrip
              allAngles={allAngles!}
              currentKey={angleKey}
              completedKeys={completedKeys}
            />
          </div>
        )}
      </div>}

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: mode === 'preview' ? 'flex-start' : 'center',
        position: 'relative',
        overflow: mode === 'preview' ? 'auto' : 'hidden',
      }}>

        {/* ══ CHOOSE MODE ══════════════════════════════════════════════════════ */}
        {mode === 'choose' && (
          <div style={{ padding: '24px 20px', width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 11 }}>

            {/* Shot guide card */}
            <div style={{
              padding: '16px 16px 15px',
              background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(129,140,248,0.03) 100%)',
              border: '1px solid rgba(34,211,238,0.14)',
              borderRadius: 16,
              marginBottom: 6,
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(34,211,238,0.1)',
                  border: '1px solid rgba(34,211,238,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(34,211,238,0.1)',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#22d3ee', marginBottom: 2 }}>
                    {t('camera.positionGuide')}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {translatedLabel}
                  </div>
                </div>
              </div>

              {/* Guide text */}
              <div style={{
                fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65,
                borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10,
              }}>
                {guideText}
              </div>
            </div>

            {/* Camera error */}
            {status === 'error' && (
              <div style={{
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.16)',
                borderRadius: 10, fontSize: 12.5, color: '#f87171', lineHeight: 1.5,
              }}>
                {t('camera.cameraUnavailable')}
              </div>
            )}

            {/* Primary CTA */}
            <button
              onClick={() => handleOpenCamera('environment')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '16px 24px',
                background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                color: '#050810',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 800, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', letterSpacing: '-0.2px',
                boxShadow: '0 4px 20px rgba(34,211,238,0.32), inset 0 1px 0 rgba(255,255,255,0.25)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              {t('camera.openCamera')}
            </button>

            {/* Secondary — Gallery */}
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '14px 24px',
                background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.62)',
                border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              {t('camera.chooseFromGallery')}
            </button>

            {/* Quality tip */}
            <div style={{
              textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)',
              letterSpacing: '0.01em', marginTop: 2,
            }}>
              {t('camera.qualityTip')}
            </div>
          </div>
        )}

        {/* ══ CAMERA MODE ══════════════════════════════════════════════════════ */}
        {mode === 'camera' && (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Capture flash */}
            {captureFlash && (
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'rgba(255,255,255,0.55)',
                animation: 'captureFlash 0.38s ease-out forwards',
                zIndex: 20,
              }} />
            )}

            {/* Loading spinner */}
            {status === 'starting' && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(8,12,20,0.8)',
              }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  border: '3px solid rgba(34,211,238,0.15)',
                  borderTopColor: '#22d3ee',
                  animation: 'spin 0.9s linear infinite',
                }} />
              </div>
            )}

            {/* Ambient gradient */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 22%, transparent 72%, rgba(0,0,0,0.7) 100%)',
            }} />

            {/* Viewfinder frame */}
            <div style={{
              position: 'absolute',
              top: 'calc(76px + env(safe-area-inset-top, 0px))', left: '7%', right: '7%',
              bottom: 'calc(136px + env(safe-area-inset-bottom, 0px))',
              pointerEvents: 'none',
            }}>
              {([
                { id: 'tl', top: 0,    left:  0, borderTop:    '2.5px solid #22d3ee', borderLeft:  '2.5px solid #22d3ee', borderRadius: '6px 0 0 0' },
                { id: 'tr', top: 0,    right: 0, borderTop:    '2.5px solid #22d3ee', borderRight: '2.5px solid #22d3ee', borderRadius: '0 6px 0 0' },
                { id: 'bl', bottom: 0, left:  0, borderBottom: '2.5px solid #22d3ee', borderLeft:  '2.5px solid #22d3ee', borderRadius: '0 0 0 6px' },
                { id: 'br', bottom: 0, right: 0, borderBottom: '2.5px solid #22d3ee', borderRight: '2.5px solid #22d3ee', borderRadius: '0 0 6px 0' },
              ] as (React.CSSProperties & { id: string })[]).map(({ id, ...s }) => (
                <div key={id} style={{
                  position: 'absolute', width: 28, height: 28,
                  filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.5))',
                  ...s,
                }} />
              ))}

              {/* Centre crosshair */}
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 5, height: 5, borderRadius: '50%',
                background: 'rgba(34,211,238,0.35)',
                boxShadow: '0 0 8px rgba(34,211,238,0.4)',
              }} />
            </div>

            {/* Camera overlay top bar — back button + centred angle label */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
              paddingLeft: 14, paddingRight: 14, paddingBottom: 10,
              zIndex: 15,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <button
                type="button"
                onClick={handleClose}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(5,8,14,0.55)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 22, cursor: 'pointer',
                  color: 'rgba(255,255,255,0.82)', fontSize: 13,
                  fontFamily: 'var(--font-sans)',
                  padding: '7px 13px 7px 9px',
                  letterSpacing: '-0.1px',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                {t('common.cancel')}
              </button>

              <div style={{
                flex: 1,
                display: 'flex', justifyContent: 'center',
                opacity: titleVisible ? 1 : 0,
                transition: 'opacity 0.22s ease',
                minWidth: 0,
              }}>
                <span style={{
                  padding: '6px 16px',
                  background: 'rgba(34,211,238,0.13)',
                  border: '1px solid rgba(34,211,238,0.25)',
                  borderRadius: 22, fontSize: 12, fontWeight: 700, color: '#22d3ee',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  letterSpacing: '-0.1px',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}>
                  {translatedLabel}
                </span>
              </div>

              {/* Right spacer — mirrors the cancel button so the label stays centred */}
              <div style={{ flexShrink: 0, width: 78 }} />
            </div>

            {/* Progress strip overlay — sits just below the top bar */}
            {showProgress && (
              <div style={{
                position: 'absolute',
                top: 'calc(58px + env(safe-area-inset-top, 0px))',
                left: 0, right: 0,
                zIndex: 14,
                display: 'flex', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <ShotProgressStrip
                  allAngles={allAngles!}
                  currentKey={angleKey}
                  completedKeys={completedKeys}
                />
              </div>
            )}

            {/* Single-line hint pill — sits just above the controls, never wraps */}
            {contextHint && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(108px + env(safe-area-inset-bottom, 0px))',
                left: 20, right: 20,
                pointerEvents: 'none',
                display: 'flex', justifyContent: 'center',
              }}>
                <div style={{
                  padding: '7px 20px',
                  background: 'rgba(5,8,14,0.75)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 22,
                  fontSize: 13, fontWeight: 600,
                  color: 'rgba(255,255,255,0.92)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  letterSpacing: '-0.1px',
                  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                }}>
                  {contextHint}
                </div>
              </div>
            )}

            {/* Controls bar */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '16px 28px',
              paddingBottom: 'calc(18px + env(safe-area-inset-bottom, 0px))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              zIndex: 5,
              background: 'linear-gradient(to top, rgba(5,8,14,0.9) 0%, rgba(5,8,14,0.6) 60%, transparent 100%)',
            }}>
              <button
                onClick={handleGalleryFromCamera}
                aria-label={t('camera.chooseFromGallery')}
                style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.8)',
                  WebkitTapHighlightColor: 'transparent',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>

              <button
                onClick={handleCapture}
                disabled={status !== 'active'}
                className="camera-btn"
                aria-label="Capture photo"
                style={{
                  width: 76, height: 76, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  border: `4px solid ${status === 'active' ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.22)'}`,
                  cursor: status === 'active' ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: status === 'active' ? '0 0 0 3px rgba(34,211,238,0.5), 0 0 22px rgba(34,211,238,0.25)' : 'none',
                  flexShrink: 0,
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: status === 'active' ? '#fff' : 'rgba(255,255,255,0.25)',
                  transition: 'background 0.2s',
                }} />
              </button>

              <button
                onClick={handleFlip}
                aria-label="Flip camera"
                style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.8)',
                  WebkitTapHighlightColor: 'transparent',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
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

        {/* ══ PREVIEW MODE ════════════════════════════════════════════════════ */}
        {mode === 'preview' && preview && (
          <div style={{ width: '100%', minHeight: 'calc(100dvh - 57px)', display: 'flex', flexDirection: 'column' }}>

            {/* Image area */}
            <div style={{
              flex: '1 1 auto', minHeight: 280,
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#000',
              overflow: 'hidden',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={translatedLabel}
                style={{
                  width: '100%',
                  maxHeight: 'calc(100svh - 220px)',
                  objectFit: 'contain',
                  background: '#000',
                  display: 'block',
                }}
              />

              {/* Vignette */}
              <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)',
              }} />

              {/* Badges — stacked: captured + quality */}
              <div style={{
                position: 'absolute', top: 16, left: 0, right: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                pointerEvents: 'none',
              }}>
                {/* Captured badge */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 16px',
                  background: 'rgba(34,197,94,0.15)',
                  border: '1px solid rgba(34,197,94,0.28)',
                  borderRadius: 20, fontSize: 12, fontWeight: 700, color: '#22c55e',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  letterSpacing: '-0.1px',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {translatedLabel}
                  {shotNumber && totalShots && (
                    <span style={{ opacity: 0.55, fontWeight: 500, fontSize: 11 }}>
                      · {shotNumber}/{totalShots}
                    </span>
                  )}
                </span>

                {/* Quality badge */}
                {qualityLabel && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 13px',
                    background: qualityIsPoor ? 'rgba(245,158,11,0.13)' : 'rgba(34,211,238,0.1)',
                    border: `1px solid ${qualityIsPoor ? 'rgba(245,158,11,0.28)' : 'rgba(34,211,238,0.22)'}`,
                    borderRadius: 16, fontSize: 11, fontWeight: 600,
                    color: qualityIsPoor ? '#fbbf24' : 'rgba(34,211,238,0.85)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    letterSpacing: '-0.1px',
                  }}>
                    {qualityIsPoor ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {qualityLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Soft warning — shown above action bar when quality is poor */}
            {qualityIsPoor && (
              <div style={{
                padding: '10px 20px',
                background: 'rgba(245,158,11,0.06)',
                borderTop: '1px solid rgba(245,158,11,0.14)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{
                  fontSize: 11.5, color: 'rgba(251,191,36,0.8)',
                  fontWeight: 500, lineHeight: 1.4,
                }}>
                  {t('camera.qualitySoftWarn')}
                </span>
              </div>
            )}

            {/* Action bar */}
            <div style={{
              padding: '14px 20px',
              paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
              background: 'rgba(8,12,20,0.98)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              display: 'flex', gap: 10,
              position: 'sticky', bottom: 0, zIndex: 2,
            }}>
              <button
                onClick={handleRetake}
                style={{
                  flex: 1, padding: '14px',
                  background: qualityIsPoor ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.05)',
                  color: qualityIsPoor ? 'rgba(251,191,36,0.85)' : 'rgba(255,255,255,0.65)',
                  border: `1px solid ${qualityIsPoor ? 'rgba(245,158,11,0.28)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 13,
                  fontSize: 14, fontWeight: qualityIsPoor ? 700 : 600, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.2s, border-color 0.2s, color 0.2s',
                }}
              >
                {t('camera.retake')}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  flex: 2, padding: '14px',
                  background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                  color: '#050810',
                  border: 'none', borderRadius: 13,
                  fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', letterSpacing: '-0.2px',
                  boxShadow: '0 4px 16px rgba(34,211,238,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                  WebkitTapHighlightColor: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                }}
              >
                {t('camera.usePhoto')}
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Keyframes for capture flash */}
      <style>{`
        @keyframes captureFlash {
          0%   { opacity: 1 }
          100% { opacity: 0 }
        }
      `}</style>
    </div>
  )
}
