'use client'

import { useRef, useState, useCallback } from 'react'

interface CameraCaptureProps {
  readonly onCapture: (file: File, previewUrl: string) => void
  readonly onClose: () => void
  readonly label: string
}

export function CameraCapture({ onCapture, onClose, label }: CameraCaptureProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)

  const [mode, setMode]       = useState<'choose' | 'camera' | 'preview'>('choose')
  const [preview, setPreview] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [cameraError, setCameraError]   = useState<string | null>(null)
  const [facingMode, setFacingMode]     = useState<'environment' | 'user'>('environment')

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setMode('camera')
    } catch {
      setCameraError('Camera unavailable. Use file upload instead.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) return
      const file = new File([blob], `${label.replace(/\s+/g, '_')}_${Date.now()}.jpg`, { type: 'image/jpeg' })
      const url  = URL.createObjectURL(blob)
      stopCamera()
      setCapturedFile(file)
      setPreview(url)
      setMode('preview')
    }, 'image/jpeg', 0.88)
  }, [label, stopCamera])

  const handleFlip = useCallback(() => {
    const next = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(next)
    stopCamera()
    startCamera(next)
  }, [facingMode, stopCamera, startCamera])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setCapturedFile(file)
    setPreview(url)
    setMode('preview')
  }, [])

  const handleConfirm = useCallback(() => {
    if (!capturedFile || !preview) return
    onCapture(capturedFile, preview)
  }, [capturedFile, preview, onCapture])

  const handleRetake = useCallback(() => {
    setPreview(null)
    setCapturedFile(null)
    setMode('choose')
  }, [])

  const handleClose = useCallback(() => {
    stopCamera()
    onClose()
  }, [stopCamera, onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#080c14',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'rgba(8,12,20,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}>
        <button onClick={handleClose} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.55)', fontSize: 14, fontFamily: 'var(--font-sans)',
          padding: '6px 0',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Cancel
        </button>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{label}</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* CHOOSE MODE */}
        {mode === 'choose' && (
          <div style={{ padding: '32px 24px', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                Take a photo of the <strong style={{ color: '#22d3ee' }}>{label}</strong>
              </div>
            </div>

            {cameraError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
                {cameraError}
              </div>
            )}

            <button
              onClick={() => startCamera('environment')}
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
              Open Camera
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
              Choose from Gallery
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* CAMERA MODE */}
        {mode === 'camera' && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Camera overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.5) 100%)',
            }} />

            {/* Corner guides */}
            <div style={{ position: 'absolute', inset: '15%', pointerEvents: 'none' }}>
              {[
                { top: 0, left: 0, borderTop: '2px solid #22d3ee', borderLeft: '2px solid #22d3ee', borderRadius: '4px 0 0 0' },
                { top: 0, right: 0, borderTop: '2px solid #22d3ee', borderRight: '2px solid #22d3ee', borderRadius: '0 4px 0 0' },
                { bottom: 0, left: 0, borderBottom: '2px solid #22d3ee', borderLeft: '2px solid #22d3ee', borderRadius: '0 0 0 4px' },
                { bottom: 0, right: 0, borderBottom: '2px solid #22d3ee', borderRight: '2px solid #22d3ee', borderRadius: '0 0 4px 0' },
              ].map((s, i) => (
                <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
              ))}
            </div>

            {/* Label overlay */}
            <div style={{
              position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center',
              pointerEvents: 'none',
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
              padding: '24px 32px',
              paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {/* Gallery shortcut */}
              <button
                onClick={() => { stopCamera(); fileInputRef.current?.click() }}
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

              {/* Shutter */}
              <button
                onClick={handleCapture}
                className="camera-btn"
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: '#fff',
                  border: '4px solid rgba(255,255,255,0.3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 2px rgba(34,211,238,0.6)',
                  flexShrink: 0,
                }}
              >
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff' }} />
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

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </>
        )}

        {/* PREVIEW MODE */}
        {mode === 'preview' && preview && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Preview image */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={label}
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
              <div style={{
                position: 'absolute', top: 16, left: 0, right: 0, textAlign: 'center',
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px',
                  background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#22c55e',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Photo captured
                </span>
              </div>
            </div>

            {/* Preview controls */}
            <div style={{
              padding: '20px 24px',
              paddingBottom: 'calc(20px + env(safe-area-inset-bottom))',
              background: 'rgba(8,12,20,0.97)',
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: 12,
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
                Retake
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
                Use Photo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
