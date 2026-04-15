'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { useVehicleStore, useInspectionStore } from '@/store'
import type { ChecklistCategory, InspectionPhase, ItemStatus } from '@/types'
import { CameraCapture } from '@/components/inspection/CameraCapture'
import { ModelResearchGuide } from '@/components/inspection/ModelResearchGuide'
import AppShell from '../AppShell'

// ─── Photo categories ──────────────────────────────────────────────────────────
const PHOTO_ANGLES = [
  { key: 'FRONT',       label: 'Front',          hint: 'Straight on from front' },
  { key: 'REAR',        label: 'Rear',            hint: 'Straight on from behind' },
  { key: 'LEFT_SIDE',   label: 'Left Side',       hint: 'Full left profile' },
  { key: 'RIGHT_SIDE',  label: 'Right Side',      hint: 'Full right profile' },
  { key: 'FRONT_LEFT',  label: 'Front-Left 45°',  hint: 'Front corner angle' },
  { key: 'FRONT_RIGHT', label: 'Front-Right 45°', hint: 'Front corner angle' },
  { key: 'HOOD',        label: 'Hood',            hint: 'Top of hood close-up' },
  { key: 'ROOF',        label: 'Roof',            hint: 'Roof panel' },
  { key: 'TRUNK',       label: 'Trunk / Boot',    hint: 'Rear trunk area' },
  { key: 'ENGINE_BAY',  label: 'Engine Bay',      hint: 'Open hood, engine visible' },
  { key: 'INTERIOR',    label: 'Interior',        hint: 'Dashboard and seats' },
  { key: 'ODOMETER',    label: 'Odometer',        hint: 'Dashboard showing mileage' },
  { key: 'VIN_PLATE',   label: 'VIN Plate',       hint: 'VIN number visible' },
  { key: 'WHEELS_FL',   label: 'Wheel – Front L', hint: 'Front left wheel close-up' },
  { key: 'WHEELS_FR',   label: 'Wheel – Front R', hint: 'Front right wheel close-up' },
  { key: 'UNDERBODY',   label: 'Underbody',       hint: 'Under vehicle if accessible' },
] as const

// ─── Phase config ──────────────────────────────────────────────────────────────
const PHASES: { phase: InspectionPhase; shortKey: string; category?: ChecklistCategory }[] = [
  { phase: 'PRE_SCREENING', shortKey: 'inspection.overviewShort',  category: 'PRE_SCREENING' },
  { phase: 'AI_PHOTOS',     shortKey: 'inspection.photosShort',    category: undefined },
  { phase: 'EXTERIOR',      shortKey: 'inspection.exteriorShort',  category: 'EXTERIOR' },
  { phase: 'INTERIOR',      shortKey: 'inspection.interiorShort',  category: 'INTERIOR' },
  { phase: 'MECHANICAL',    shortKey: 'inspection.mechShort',      category: 'MECHANICAL' },
  { phase: 'TEST_DRIVE',    shortKey: 'inspection.driveShort',     category: 'TEST_DRIVE' },
  { phase: 'VIN_DOCS',      shortKey: 'inspection.docsShort',      category: 'DOCUMENTS' },
  { phase: 'RISK_ANALYSIS', shortKey: 'inspection.scoreShort',     category: undefined },
]

const STATUS_CFG = {
  PENDING: { bg: 'transparent',            border: 'rgba(255,255,255,0.10)', text: 'rgba(255,255,255,0.55)', icon: null,  glow: 'none' },
  OK:      { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.3)',    text: '#22c55e',                icon: '✓',   glow: '0 0 12px rgba(34,197,94,0.2)' },
  WARNING: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.3)',   text: '#f59e0b',                icon: '!',   glow: '0 0 12px rgba(245,158,11,0.2)' },
  PROBLEM: { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.3)',    text: '#ef4444',                icon: '✕',   glow: '0 0 12px rgba(239,68,68,0.2)' },
} as const

type PhotoEntry   = { key: string; label: string; file: File; previewUrl: string; aiPending: boolean; aiResult?: MockAIResult }
type PhotoIssue = { area: string; issue: string; severity: 'minor' | 'moderate' | 'serious'; confidence: number }
type MockAIResult = {
  signal: string
  severity: 'ok' | 'warn' | 'flag'
  detail: string
  imageQuality?: 'good' | 'medium' | 'poor' | 'unusable'
  visibleAreas?: string[]
  detectedIssues?: PhotoIssue[]
  possibleIssues?: PhotoIssue[]
  uncertainAreas?: string[]
  confidenceScore?: number
  recommendation?: string
  failureReason?: string
}
type ChecklistRow = { id: string; itemKey: string; itemLabel: string; status: ItemStatus; notes?: string | null }
type PreparedAIImage = { imageBase64: string; mimeType: string; width: number; height: number; size: number }

const AI_IMAGE_MAX_DIMENSION = 1600
const AI_IMAGE_QUALITY = 0.82

function logPhotoFlow(step: string, details?: Record<string, unknown>) {
  console.info(`[inspection/photo] ${step}`, details ?? {})
}

// ─── Photo draft persistence (survives refresh / navigation) ──────────────────
const PHOTO_DRAFT_KEY = 'uci-photo-drafts'

interface PhotoDraft {
  vehicleId: string
  key: string
  label: string
  thumbUrl: string        // compressed data URL (~40 KB), safe for localStorage
  aiResult?: MockAIResult
}

function loadPhotoDrafts(vehicleId: string): PhotoDraft[] {
  try {
    const raw = localStorage.getItem(PHOTO_DRAFT_KEY)
    if (!raw) return []
    return (JSON.parse(raw) as PhotoDraft[]).filter(d => d.vehicleId === vehicleId)
  } catch { return [] }
}

function savePhotoDraft(draft: PhotoDraft) {
  try {
    const raw = localStorage.getItem(PHOTO_DRAFT_KEY)
    const all: PhotoDraft[] = raw ? JSON.parse(raw) : []
    // Replace existing entry for same vehicle+angle, then append
    const filtered = all.filter(d => !(d.vehicleId === draft.vehicleId && d.key === draft.key))
    filtered.push(draft)
    localStorage.setItem(PHOTO_DRAFT_KEY, JSON.stringify(filtered))
  } catch { /* localStorage quota exceeded — skip */ }
}

/** Downsample a File to a ≤360px-wide JPEG data URL (~30–60 KB). */
async function toThumbnailDataUrl(file: File, maxWidth = 360): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale   = Math.min(1, maxWidth / img.width)
        const canvas  = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.65))
      }
      img.onerror = () => resolve('')
      img.src = reader.result as string
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

// ─── Real AI analysis via OpenAI Vision ───────────────────────────────────────

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Browser could not decode image type "${file.type || 'unknown'}"`))
    }
    img.src = url
  })
}

async function loadBitmapWithOrientation(file: File): Promise<ImageBitmap | null> {
  if (!('createImageBitmap' in window)) return null

  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch (err) {
    logPhotoFlow('image_bitmap_orientation_failed', {
      reason: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode image for AI analysis'))
    }, 'image/jpeg', AI_IMAGE_QUALITY)
  })
}

async function prepareImageForAI(file: File): Promise<PreparedAIImage> {
  if (file.type && !file.type.startsWith('image/')) {
    throw new Error(`Unsupported file type "${file.type || 'unknown'}"`)
  }

  const bitmap = await loadBitmapWithOrientation(file)
  const img = bitmap ? null : await loadImage(file)
  const sourceWidth = bitmap?.width ?? img?.naturalWidth ?? 0
  const sourceHeight = bitmap?.height ?? img?.naturalHeight ?? 0
  if (!sourceWidth || !sourceHeight) {
    bitmap?.close()
    throw new Error('Image decoded with empty dimensions')
  }

  const scale = Math.min(1, AI_IMAGE_MAX_DIMENSION / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap?.close()
    throw new Error('Canvas is unavailable for image preprocessing')
  }
  if (bitmap) {
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
  } else if (img) {
    ctx.drawImage(img, 0, 0, width, height)
  }
  const blob = await canvasToJpegBlob(canvas)

  return {
    imageBase64: await blobToBase64(blob),
    mimeType: 'image/jpeg',
    width,
    height,
    size: blob.size,
  }
}

function getAuthHeader(): string {
  try {
    const stored = sessionStorage.getItem('uci-user-store')
    if (stored) {
      const token = JSON.parse(stored)?.state?.session?.accessToken
      if (token) return `Bearer ${token}`
    }
  } catch { /* ignore */ }

  try { localStorage.removeItem('uci-user-store') } catch { /* ignore legacy auth cache */ }
  return ''
}

async function runAI(key: string, label: string, file: File, fallbackSignal: string, fallbackDetail: string, locale: string): Promise<MockAIResult> {
  const startedAt = Date.now()
  try {
    logPhotoFlow('ai_prepare_started', { key, label, originalSize: file.size, originalType: file.type })
    const prepared = await prepareImageForAI(file)
    logPhotoFlow('ai_prepare_finished', {
      key,
      preparedSize: prepared.size,
      width: prepared.width,
      height: prepared.height,
      mimeType: prepared.mimeType,
    })

    const authHeader = getAuthHeader()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 45000)
    let res: Response
    try {
      logPhotoFlow('ai_request_sent', { key, label })
      res = await fetch('/api/inspection/analyze-photo', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          imageBase64: prepared.imageBase64,
          mimeType: prepared.mimeType,
          angle: key,
          angleLabel: label,
          locale,
          imageMeta: {
            width: prepared.width,
            height: prepared.height,
            size: prepared.size,
            originalType: file.type,
            originalSize: file.size,
          },
        }),
      })
    } finally {
      window.clearTimeout(timeout)
    }

    const raw = await res.text()
    let json: { data?: MockAIResult; message?: string; error?: string } | null = null
    try {
      json = raw ? JSON.parse(raw) : null
    } catch {
      throw new Error(`AI response was not JSON (${res.status})`)
    }

    logPhotoFlow('ai_response_received', { key, status: res.status, elapsedMs: Date.now() - startedAt, hasData: !!json?.data })
    if (json?.data) {
      logPhotoFlow('ai_parse_result', {
        key,
        severity: json.data.severity,
        imageQuality: json.data.imageQuality,
        confidenceScore: json.data.confidenceScore,
        detectedIssues: json.data.detectedIssues?.length ?? 0,
        possibleIssues: json.data.possibleIssues?.length ?? 0,
      })
      return json.data
    }
    throw new Error(json?.message ?? json?.error ?? `AI request failed with HTTP ${res.status}`)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    logPhotoFlow('ai_failure', { key, reason, elapsedMs: Date.now() - startedAt })
    const detail = reason.includes('decode') || reason.includes('Unsupported')
      ? `This image could not be prepared for AI analysis (${reason}). Try a JPEG, PNG, or a fresh camera capture.`
      : `${fallbackDetail} (${reason})`
    return {
      signal: fallbackSignal,
      severity: 'warn',
      detail,
      imageQuality: 'unusable',
      visibleAreas: [],
      detectedIssues: [],
      possibleIssues: [],
      uncertainAreas: ['AI analysis did not complete'],
      confidenceScore: 0,
      recommendation: 'Retake the photo or try again with a stable network connection.',
      failureReason: reason,
    }
  }
}

// ─── AI Badge ─────────────────────────────────────────────────────────────────
function AIBadge({ result }: Readonly<{ result: MockAIResult }>) {
  const colors = {
    ok:   { bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.22)',  text: '#22c55e', dot: '#22c55e' },
    warn: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.22)', text: '#f59e0b', dot: '#f59e0b' },
    flag: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.22)',  text: '#ef4444', dot: '#ef4444' },
  }
  const c = colors[result.severity]
  const visibleAreas = result.visibleAreas?.slice(0, 3) ?? []
  const issues = [
    ...(result.detectedIssues ?? []).slice(0, 2),
    ...(result.possibleIssues ?? []).slice(0, 1),
  ].slice(0, 3)
  return (
    <div style={{ padding: '8px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, marginTop: 8, display: 'flex', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{result.signal}</div>
          {result.imageQuality && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.42)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              padding: '1px 5px',
            }}>
              {result.imageQuality}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{result.detail}</div>
        {visibleAreas.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'rgba(255,255,255,0.34)', lineHeight: 1.45 }}>
            Visible: {visibleAreas.join(', ')}
          </div>
        )}
        {issues.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {issues.map((issue, idx) => (
              <div key={`${issue.area}-${idx}`} style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.45 }}>
                {issue.area}: {issue.issue}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onAdd }: Readonly<{ photos: PhotoEntry[]; onAdd: (key: string, label: string) => void }>) {
  const { t }     = useTranslation()
  const captured  = photos.length
  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.62)' }}>
          {t('inspection.photosCaptured', { count: captured, total: PHOTO_ANGLES.length })}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(captured / PHOTO_ANGLES.length) * 100}%`, background: '#22d3ee', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{Math.round((captured / PHOTO_ANGLES.length) * 100)}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {PHOTO_ANGLES.map(angle => {
          const photo = photos.find(p => p.key === angle.key)
          return (
            <div key={angle.key} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px',
              background: photo ? 'rgba(34,211,238,0.03)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${photo ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 12,
              transition: 'border-color 0.15s, background 0.15s',
            }}>
              {/* Thumbnail */}
              <div style={{
                width: 54, height: 54, borderRadius: 10, flexShrink: 0,
                overflow: 'hidden',
                background: photo ? 'transparent' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${photo ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.07)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.previewUrl} alt={t(`angle.${angle.key}`, { defaultValue: angle.label })} className="photo-thumb" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
                {photo?.aiPending && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                )}
              </div>

              {/* Info + AI result */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: photo ? '#fff' : 'rgba(255,255,255,0.80)' }}>{t(`angle.${angle.key}`, { defaultValue: angle.label })}</span>
                  {photo && !photo.aiPending && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: 'rgba(34,211,238,0.1)', color: '#22d3ee', letterSpacing: '0.04em' }}>AI</span>
                  )}
                  {photo?.aiPending && (
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '1px 5px', borderRadius: 4, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', letterSpacing: '0.04em' }}>{t('inspection.analysing')}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.52)' }}>{t(`hint.${angle.key}`, { defaultValue: angle.hint })}</div>
                {photo?.aiResult && <AIBadge result={photo.aiResult} />}
              </div>

              {/* Capture / retake button */}
              <button
                onClick={() => onAdd(angle.key, t(`angle.${angle.key}`, { defaultValue: angle.label }))}
                style={{
                  flexShrink: 0, width: 40, height: 40,
                  background: photo ? 'rgba(255,255,255,0.04)' : 'rgba(34,211,238,0.09)',
                  border: `1px solid ${photo ? 'rgba(255,255,255,0.09)' : 'rgba(34,211,238,0.22)'}`,
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: photo ? 'rgba(255,255,255,0.35)' : '#22d3ee',
                  transition: 'all 0.15s',
                }}
                aria-label={photo ? `Retake ${angle.label}` : `Capture ${angle.label}`}
              >
                {photo ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Checklist Phase ──────────────────────────────────────────────────────────
function ChecklistPhase({ items, isLoading, onStatus, onNotes }: Readonly<{
  items: ChecklistRow[]
  isLoading: boolean
  onStatus: (id: string, st: ItemStatus) => void
  onNotes:  (id: string, notes: string) => void
}>) {
  const { t } = useTranslation()

  // ── Notes state ──────────────────────────────────────────────────────────────
  // Initialise from persisted notes on mount; draft state is the source of truth in-UI
  const [noteExpanded, setNoteExpanded] = useState<Record<string, boolean>>({})
  const [noteDraft,    setNoteDraft]    = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    items.forEach(i => { init[i.id] = i.notes ?? '' })
    return init
  })
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Keep draft in sync if items reload from Zustand (e.g. after session restore)
  useEffect(() => {
    setNoteDraft(prev => {
      const next = { ...prev }
      items.forEach(i => {
        if (next[i.id] === undefined) next[i.id] = i.notes ?? ''
      })
      return next
    })
  }, [items])

  const handleNoteChange = (id: string, value: string) => {
    setNoteDraft(prev => ({ ...prev, [id]: value }))
    clearTimeout(noteTimers.current[id])
    noteTimers.current[id] = setTimeout(() => onNotes(id, value), 500)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} className="skeleton" style={{ height: 78, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.28)' }}>{t('inspection.noItems')}</div>
      </div>
    )
  }

  const done = items.filter(i => i.status !== 'PENDING').length
  return (
    <div>
      {/* Mini progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.58)', fontWeight: 500 }}>
          {t('inspection.checkedProgress', { done, total: items.length })}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {items.map(item => (
            <div key={item.id} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: item.status === 'OK' ? '#22c55e' : item.status === 'WARNING' ? '#f59e0b' : item.status === 'PROBLEM' ? '#ef4444' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const s         = STATUS_CFG[item.status]
          const hasNote   = !!(noteDraft[item.id])
          const expanded  = noteExpanded[item.id] ?? false
          const helperText = t(`checklistHelper.${item.itemKey}`, { defaultValue: '' })
          return (
            <div key={item.id} style={{
              padding: '13px 14px', borderRadius: 12,
              background: s.bg, border: `1px solid ${s.border}`,
              transition: 'background 0.15s, border-color 0.15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: item.status === 'PENDING' ? 'rgba(255,255,255,0.82)' : '#fff', marginBottom: 10, lineHeight: 1.4 }}>
                {t(`checklist.${item.itemKey}`, { defaultValue: item.itemLabel })}
              </div>
              {helperText && (
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.55, margin: '-3px 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {helperText}
                </div>
              )}

              {/* Note toggle + textarea */}
              <div style={{ marginBottom: 9 }}>
                <button
                  onClick={() => setNoteExpanded(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 8px',
                    background: 'transparent',
                    border: `1px solid ${hasNote ? 'rgba(34,211,238,0.18)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 6,
                    fontSize: 11, fontWeight: 500,
                    color: hasNote ? 'rgba(34,211,238,0.7)' : 'rgba(255,255,255,0.28)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  {t('inspection.note')}
                  {hasNote && (
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#22d3ee', flexShrink: 0 }} />
                  )}
                </button>

                {expanded && (
                  <textarea
                    value={noteDraft[item.id] ?? ''}
                    onChange={e => handleNoteChange(item.id, e.target.value)}
                    placeholder={t(`checklistPlaceholder.${item.itemKey}`, { defaultValue: t('inspection.notePlaceholder') })}
                    rows={2}
                    style={{
                      display: 'block', marginTop: 7, width: '100%',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 9,
                      padding: '9px 11px',
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: 12, lineHeight: 1.6,
                      fontFamily: 'var(--font-sans)',
                      resize: 'none', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>

              {/* Status buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {(['OK', 'WARNING', 'PROBLEM'] as ItemStatus[]).map(st => {
                  const cfg = STATUS_CFG[st]
                  const sel = item.status === st
                  const labels: Record<string, string> = { OK: t('inspection.statusOK'), WARNING: t('inspection.statusWarning'), PROBLEM: t('inspection.statusIssue') }
                  return (
                    <button
                      key={st}
                      onClick={() => onStatus(item.id, st)}
                      style={{
                        flex: 1, padding: '10px 4px', borderRadius: 10,
                        border: `1px solid ${sel ? cfg.border : 'rgba(255,255,255,0.07)'}`,
                        background: sel ? cfg.bg : 'rgba(255,255,255,0.02)',
                        color: sel ? cfg.text : 'rgba(255,255,255,0.28)',
                        fontSize: 12, fontWeight: sel ? 700 : 400,
                        cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        transition: 'all 0.15s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        boxShadow: sel ? cfg.glow : 'none',
                        letterSpacing: sel ? '-0.1px' : '0',
                      }}
                    >
                      {sel && cfg.icon && (
                        <span style={{ fontSize: 10, fontWeight: 900, lineHeight: 1 }}>{cfg.icon}</span>
                      )}
                      {labels[st]}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Risk Analysis ─────────────────────────────────────────────────────────────
function RiskAnalysisPhase({ photos }: Readonly<{ photos: PhotoEntry[] }>) {
  const { t }   = useTranslation()
  const flagged = photos.filter(p => p.aiResult && p.aiResult.severity !== 'ok')
  const allOk   = flagged.length === 0 && photos.length > 0

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            {t('inspection.photoAnalysisSummary')}
          </div>
          {allOk ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{t('inspection.noFlagsRaised')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {flagged.map(p => (
                <div key={p.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: p.aiResult?.severity === 'flag' ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)',
                  border: `1px solid ${p.aiResult?.severity === 'flag' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`,
                  borderRadius: 10,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.aiResult?.severity === 'flag' ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{p.aiResult?.signal}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '12px 0 4px' }}>
        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
          {t('inspection.allPhasesComplete')}
        </div>
        <Link
          href="/report"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '15px 0',
            background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
            color: '#050810', borderRadius: 14, fontSize: 15, fontWeight: 800,
            textDecoration: 'none', letterSpacing: '-0.2px',
            boxShadow: '0 4px 24px rgba(34,211,238,0.36), inset 0 1px 0 rgba(255,255,255,0.25)',
            width: '100%',
          }}
        >
          {t('inspection.viewAIReport')}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InspectionPage() {
  const { t, i18n }       = useTranslation()
  const { activeVehicle } = useVehicleStore()
  const {
    session, currentPhase, checklistItems, isLoadingChecklist, error,
    initSession, setPhase, updateChecklistItem, getItemsByCategory, pushAIResult,
  } = useInspectionStore()

  const [photos, setPhotos]             = useState<PhotoEntry[]>([])
  const [cameraTarget, setCameraTarget] = useState<{ key: string; label: string } | null>(null)
  const [findingsSaved, setFindingsSaved] = useState(false)

  useEffect(() => {
    if (activeVehicle?.id && !session) initSession(activeVehicle.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicle?.id])

  // Restore photo drafts when a persisted session is loaded (survives refresh / reopen)
  useEffect(() => {
    const vehicleId = session?.vehicleId
    if (!vehicleId) return
    const drafts = loadPhotoDrafts(vehicleId)
    if (drafts.length === 0) return
    setPhotos(drafts.map(d => ({
      key:       d.key,
      label:     d.label,
      file:      new File([], d.key, { type: 'image/jpeg' }), // placeholder — AI already done
      previewUrl: d.thumbUrl,
      aiPending: false,
      aiResult:  d.aiResult,
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.vehicleId])

  // When the user reaches the RISK_ANALYSIS phase, persist all photo AI findings
  // to the DB so the scoring service can factor them in, and push into the store
  // so the report's "AI Findings" section is populated.
  useEffect(() => {
    if (currentPhase !== 'RISK_ANALYSIS') return
    if (findingsSaved) return
    const vehicleId = activeVehicle?.id
    if (!vehicleId) return
    const completed = photos.filter(p => p.aiResult && !p.aiPending)
    if (completed.length === 0) return

    setFindingsSaved(true)

    const photoResults = completed.map(p => ({
      angle:    p.key,
      label:    p.label,
      signal:   p.aiResult!.signal,
      severity: p.aiResult!.severity,
      detail:   p.aiResult!.detail,
    }))

    const authHeader = getAuthHeader()

    fetch('/api/ai-analysis/analyze', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ vehicleId, photoResults }),
    })
      .then(r => r.json())
      .then(json => { if (json?.data) pushAIResult(json.data) })
      .catch(err => console.error('[inspection] failed to save photo findings:', err))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase])

  const phaseIdx  = PHASES.findIndex(p => p.phase === currentPhase)
  const phaseCfg  = PHASES[phaseIdx]
  const items     = phaseCfg?.category ? getItemsByCategory(phaseCfg.category) : []
  const checked   = checklistItems.filter(i => i.status !== 'PENDING').length
  const total     = checklistItems.length
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0

  const goNext = () => { const n = PHASES[phaseIdx + 1]; if (n) setPhase(n.phase) }
  const goPrev = () => { const p = PHASES[phaseIdx - 1]; if (p) setPhase(p.phase) }

  // ── Autosave indicator ────────────────────────────────────────────────────
  const [showSaved,   setShowSaved]  = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markSaved = useCallback(() => {
    setShowSaved(true)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 2200)
  }, [])

  const handleStatus = (itemId: string, status: ItemStatus) => {
    updateChecklistItem(itemId, status).then(markSaved).catch(() => {})
  }

  const handleNotes = useCallback(
    (itemId: string, notes: string) => {
      const item = checklistItems.find(i => i.id === itemId)
      if (item) updateChecklistItem(itemId, item.status, notes).then(markSaved).catch(() => {})
    },
    [checklistItems, updateChecklistItem, markSaved]
  )

  const handleOpenCamera = useCallback((key: string, label: string) => {
    logPhotoFlow('capture_flow_opened', { key, label })
    setCameraTarget({ key, label })
  }, [])

  const handleCapture = useCallback(async (file: File, previewUrl: string) => {
    if (!cameraTarget) return
    logPhotoFlow('confirm_received', { key: cameraTarget.key, label: cameraTarget.label, size: file.size, type: file.type })
    const entry: PhotoEntry = { key: cameraTarget.key, label: cameraTarget.label, file, previewUrl, aiPending: true }
    setPhotos(prev => [...prev.filter(p => p.key !== cameraTarget.key), entry])
    setCameraTarget(null)

    // Step 1: generate thumbnail (fast ~100ms) and save immediately
    // This guarantees the photo is persisted even if the user closes the app
    // before AI analysis completes.
    const thumbUrl     = await toThumbnailDataUrl(file)
    const vehicleId    = session?.vehicleId
    if (vehicleId && thumbUrl) {
      logPhotoFlow('upload_started', { key: entry.key, vehicleId, target: 'local_draft' })
      savePhotoDraft({ vehicleId, key: entry.key, label: entry.label, thumbUrl })
      logPhotoFlow('upload_finished', { key: entry.key, vehicleId, target: 'local_draft' })
    }

    // Step 2: run AI analysis
    const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]
    const result = await runAI(entry.key, entry.label, file, t('inspection.analysisUnavailable'), t('inspection.analysisError'), locale)
    setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, aiPending: false, aiResult: result } : p))
    logPhotoFlow('ai_result_applied', { key: entry.key, severity: result.severity, signal: result.signal })

    // Step 3: update persisted draft with AI result
    if (vehicleId && thumbUrl) {
      logPhotoFlow('upload_started', { key: entry.key, vehicleId, target: 'local_draft_with_ai' })
      savePhotoDraft({ vehicleId, key: entry.key, label: entry.label, thumbUrl, aiResult: result })
      logPhotoFlow('upload_finished', { key: entry.key, vehicleId, target: 'local_draft_with_ai' })
    }
  }, [cameraTarget, i18n.language, i18n.resolvedLanguage, session, t])

  // ── No vehicle ──
  if (!activeVehicle) {
    return (
      <AppShell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px', gap: 20, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.4px' }}>{t('inspection.noVehicle')}</h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6 }}>{t('inspection.noVehicleDesc')}</p>
          </div>
          <Link href="/vehicle" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '14px 28px', background: '#22d3ee', color: '#000', borderRadius: 12, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            {t('inspection.goToVehicles')}
          </Link>
        </div>
      </AppShell>
    )
  }

  const isFirst = phaseIdx === 0
  const isLast  = phaseIdx === PHASES.length - 1

  return (
    <AppShell>
      {cameraTarget && (
        <CameraCapture
          label={cameraTarget.label}
          onCapture={handleCapture}
          onClose={() => setCameraTarget(null)}
        />
      )}

      <div style={{ maxWidth: 680 }}>

        {/* Vehicle banner — premium glass card */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px 14px 20px', marginBottom: 12,
          background: 'linear-gradient(135deg, rgba(34,211,238,0.07) 0%, rgba(34,211,238,0.02) 55%, rgba(129,140,248,0.02) 100%)',
          border: '1px solid rgba(34,211,238,0.16)',
          borderRadius: 18,
          boxShadow: '0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Left accent bar */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
            background: 'linear-gradient(to bottom, #22d3ee 0%, rgba(34,211,238,0.2) 100%)',
            borderRadius: '18px 0 0 18px',
          }} />

          {/* Icon */}
          <div style={{
            width: 44, height: 44, borderRadius: 13, flexShrink: 0,
            background: 'rgba(34,211,238,0.09)',
            border: '1px solid rgba(34,211,238,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 18px rgba(34,211,238,0.12)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/>
              <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
            </svg>
          </div>

          {/* Vehicle info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{t('inspection.inspecting')}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeVehicle.make} {activeVehicle.model}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{activeVehicle.year}</div>
          </div>

          {/* Progress ring */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke={progress >= 80 ? '#22c55e' : progress >= 40 ? '#22d3ee' : '#818cf8'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x="22" y="26" textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="11" fontWeight="800" fontFamily="var(--font-sans)">{progress}%</text>
            </svg>
          </div>
        </div>

        {/* Step tabs — floating glass segmented control */}
        <div className="tab-scroll-container no-scroll-bar" style={{ marginBottom: 12 } as React.CSSProperties}>
          {PHASES.map((p, idx) => {
            const isActive  = p.phase === currentPhase
            const isDone    = idx < phaseIdx
            return (
              <button
                key={p.phase}
                onClick={() => setPhase(p.phase)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 10px', borderRadius: 10, flexShrink: 0,
                  border: `1px solid ${isActive ? 'rgba(34,211,238,0.32)' : isDone ? 'rgba(34,197,94,0.18)' : 'transparent'}`,
                  background: isActive
                    ? 'rgba(34,211,238,0.13)'
                    : isDone ? 'rgba(34,197,94,0.05)' : 'transparent',
                  color: isActive ? '#22d3ee' : isDone ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  fontSize: 11.5, fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
                  transition: 'all 0.18s ease',
                  boxShadow: isActive ? '0 2px 12px rgba(34,211,238,0.16), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                  letterSpacing: isActive ? '-0.1px' : '0',
                }}
              >
                {/* Badge */}
                <span style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800,
                  background: isActive ? '#22d3ee' : isDone ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                  color: isActive ? '#050810' : isDone ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  boxShadow: isActive ? '0 0 8px rgba(34,211,238,0.4)' : 'none',
                  transition: 'all 0.18s ease',
                }}>
                  {isDone
                    ? <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : idx + 1
                  }
                </span>
                {t(p.shortKey)}
              </button>
            )
          })}
        </div>

        {/* Phase card */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 18,
          padding: '18px 16px',
          marginBottom: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Phase header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Accent bar */}
              <div style={{ width: 3, height: 28, borderRadius: 2, background: 'linear-gradient(to bottom, #22d3ee, rgba(34,211,238,0.2))', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.4px', lineHeight: 1.2 }}>{phaseCfg ? t(`phase.${phaseCfg.phase}`) : ''}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  {t('inspection.stepOf', { step: phaseIdx + 1, total: PHASES.length })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Autosave confirmation pill */}
              {showSaved && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 9px',
                  background: 'rgba(34,197,94,0.07)',
                  border: '1px solid rgba(34,197,94,0.18)',
                  borderRadius: 7,
                  animation: 'fadeIn 0.18s ease',
                }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#22c55e', letterSpacing: '0.02em' }}>
                    {t('inspection.saved')}
                  </span>
                </div>
              )}
              {/* AI analysing pill */}
              {currentPhase === 'AI_PHOTOS' && photos.some(p => p.aiPending) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse-dot 1.2s ease-in-out infinite' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b' }}>{t('inspection.aiAnalysing')}</span>
                </div>
              )}
            </div>
          </div>

          {/* PRE_SCREENING */}
          {currentPhase === 'PRE_SCREENING' && (
            <div style={{ marginBottom: 4 }}>
              <ModelResearchGuide
                make={activeVehicle.make}
                model={activeVehicle.model}
                year={activeVehicle.year}
                engineCc={activeVehicle.engineCc}
                powerKw={activeVehicle.powerKw}
                askingPrice={activeVehicle.askingPrice}
                currency={activeVehicle.currency}
                fuelType={activeVehicle.fuelType}
                transmission={activeVehicle.transmission}
                bodyType={activeVehicle.bodyType}
                mileage={activeVehicle.mileage}
              />
            </div>
          )}

          {/* AI_PHOTOS */}
          {currentPhase === 'AI_PHOTOS' && (
            <div>
              <div style={{
                padding: '11px 14px', marginBottom: 14,
                background: 'linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(129,140,248,0.03) 100%)',
                border: '1px solid rgba(34,211,238,0.13)',
                borderRadius: 12,
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{t('inspection.aiPhotoTitle')}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                    {t('inspection.aiPhotoDesc')}
                  </div>
                </div>
              </div>
              <PhotoGrid photos={photos} onAdd={handleOpenCamera} />
            </div>
          )}

          {/* RISK_ANALYSIS */}
          {currentPhase === 'RISK_ANALYSIS' && <RiskAnalysisPhase photos={photos} />}

          {/* All checklist phases */}
          {currentPhase !== 'AI_PHOTOS' && currentPhase !== 'RISK_ANALYSIS' && currentPhase !== 'PRE_SCREENING' && (
            <ChecklistPhase items={items} isLoading={isLoadingChecklist} onStatus={handleStatus} onNotes={handleNotes} />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {/* Back — ghost button */}
          <button
            onClick={goPrev}
            disabled={isFirst}
            style={{
              flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '0 18px', height: 52,
              background: 'transparent',
              border: `1px solid ${isFirst ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 14,
              fontSize: 13, color: isFirst ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.65)',
              cursor: isFirst ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            {t('common.back')}
          </button>

          {/* Next — solid gradient CTA */}
          <button
            onClick={goNext}
            disabled={isLast}
            className={!isLast ? 'btn-cta' : ''}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              height: 52, borderRadius: 14,
              background: isLast
                ? 'rgba(255,255,255,0.02)'
                : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              border: isLast ? '1px solid rgba(255,255,255,0.05)' : 'none',
              fontSize: 14, fontWeight: 800,
              color: isLast ? 'rgba(255,255,255,0.1)' : '#050810',
              cursor: isLast ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-sans)',
              letterSpacing: isLast ? '0' : '-0.2px',
              boxShadow: isLast ? 'none' : '0 4px 20px rgba(34,211,238,0.32), inset 0 1px 0 rgba(255,255,255,0.25)',
              transition: 'box-shadow 0.2s ease, transform 0.1s ease',
            }}
          >
            {phaseIdx === PHASES.length - 2 ? t('inspection.finishAndScore') : t('common.continue')}
            {!isLast && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            )}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10, fontSize: 13, color: '#f87171' }}>
            {error}
          </div>
        )}
      </div>
    </AppShell>
  )
}
