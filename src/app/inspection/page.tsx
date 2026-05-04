'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useVehicleStore, useInspectionStore } from '@/store'
import type { ChecklistCategory, InspectionPhase, ItemStatus } from '@/types'
import { CameraCapture } from '@/components/inspection/CameraCapture'
import { AiConsentModal } from '@/components/inspection/AiConsentModal'
import { ModelResearchGuide } from '@/components/inspection/ModelResearchGuide'
import { PhotoAnalysisDisclaimer } from '@/components/legal/PhotoAnalysisDisclaimer'
import { getChecklistDiagnostics, getInspectionCompletion } from '@/lib/inspection/checklist'
import { generateRequestId, pipelineLog } from '@/lib/logger'
import AppShell from '../AppShell'

// ─── AI photo slots — 8 exterior angles ──────────────────────────────────────
const PHOTO_ANGLES = [
  { key: 'FRONT',             label: 'Front',            hint: 'Straight from the front' },
  { key: 'FRONT_ANGLE_LEFT',  label: 'Front-Left 45°',   hint: 'Front-left corner, 45°' },
  { key: 'FRONT_ANGLE_RIGHT', label: 'Front-Right 45°',  hint: 'Front-right corner, 45°' },
  { key: 'LEFT_SIDE',         label: 'Left Side',        hint: 'Full left profile' },
  { key: 'RIGHT_SIDE',        label: 'Right Side',       hint: 'Full right profile' },
  { key: 'REAR',              label: 'Rear',             hint: 'Straight from the rear' },
  { key: 'REAR_ANGLE_LEFT',   label: 'Rear-Left 45°',    hint: 'Rear-left corner, 45°' },
  { key: 'REAR_ANGLE_RIGHT',  label: 'Rear-Right 45°',   hint: 'Rear-right corner, 45°' },
] as const

// Grid row grouping — drives the 3+2+3 layout
const PHOTO_ROWS = [
  { rowKey: 'front', labelKey: 'inspection.rowFront', cols: 3, angles: ['FRONT', 'FRONT_ANGLE_LEFT', 'FRONT_ANGLE_RIGHT'] },
  { rowKey: 'sides', labelKey: 'inspection.rowSides', cols: 2, angles: ['LEFT_SIDE', 'RIGHT_SIDE'] },
  { rowKey: 'rear',  labelKey: 'inspection.rowRear',  cols: 3, angles: ['REAR', 'REAR_ANGLE_LEFT', 'REAR_ANGLE_RIGHT'] },
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
  isUsable?: boolean
  usabilityReason?: 'NOT_VEHICLE' | 'LOW_QUALITY' | 'UNCERTAIN' | 'OK'
  /** Server-confirmed requestId for cross-log correlation (T5.2). */
  requestId?: string
}
type ChecklistRow = { id: string; itemKey: string; itemLabel: string; status: ItemStatus; notes?: string | null }
type PreparedAIImage = { imageBase64: string; mimeType: string; width: number; height: number; size: number }

const AI_IMAGE_MAX_DIMENSION = 1024
const AI_IMAGE_QUALITY = 0.82
const AI_REQUEST_TIMEOUT_MS = 35_000
const AI_MAX_ATTEMPTS = 3
/** Must match MAX_IMAGE_BYTES on the server. Checked after client compression. */
const MAX_CLIENT_IMAGE_BYTES = 750 * 1024

// All 8 exterior slots are analysed. Angle shots expose accident damage best;
// side shots provide supporting context on panel continuity.
const AI_PRIORITY_ANGLES = new Set([
  'FRONT', 'FRONT_ANGLE_LEFT', 'FRONT_ANGLE_RIGHT',
  'LEFT_SIDE', 'RIGHT_SIDE',
  'REAR', 'REAR_ANGLE_LEFT', 'REAR_ANGLE_RIGHT',
])

let aiAnalysisQueue: Promise<unknown> = Promise.resolve()

/**
 * Derives usability from the AI result.
 * Trusts the server-supplied `isUsable` field when present (new responses);
 * falls back to local inference for photos restored from localStorage cache.
 */
function deriveUsability(result: MockAIResult): { isUsable: boolean; usabilityReason: string } {
  if (result.isUsable !== undefined) {
    return { isUsable: result.isUsable, usabilityReason: result.usabilityReason ?? 'OK' }
  }
  if (result.failureReason) return { isUsable: false, usabilityReason: 'LOW_QUALITY' }
  if (result.imageQuality === 'unusable') {
    const sig = (result.signal ?? '').toLowerCase()
    return {
      isUsable: false,
      usabilityReason: (sig.includes('inspectable') || sig.includes('vehicle') || sig.includes('car'))
        ? 'NOT_VEHICLE'
        : 'LOW_QUALITY',
    }
  }
  const conf = result.confidenceScore ?? 100
  if (conf < 40) return { isUsable: false, usabilityReason: 'UNCERTAIN' }
  return { isUsable: true, usabilityReason: 'OK' }
}

function logPhotoFlow(step: string, details?: Record<string, unknown>, success = true, requestId?: string) {
  const durationMs = typeof details?.durationMs === 'number' ? details.durationMs : 0
  const meta = { ...(details ?? {}) }
  delete meta.durationMs
  pipelineLog({
    step: `inspection/photo:${step}`,
    requestId: requestId ?? generateRequestId(),
    success,
    durationMs,
    meta,
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


function friendlyAIDetail(fallbackDetail: string, reason: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (reason === 'IMAGE_VALIDATION') return t('inspection.analysisFailedImage',   { defaultValue: fallbackDetail })
  if (reason === 'TIMEOUT')          return t('inspection.analysisFailedTimeout', { defaultValue: fallbackDetail })
  // Only actual 429 rate-limit bursts should show "busy" — outages, config errors, and
  // unknown failures use the generic error message which is more accurate.
  if (reason === 'RATE_LIMIT')       return t('inspection.analysisFailedBusy',    { defaultValue: fallbackDetail })
  if (reason === 'CONFIG_ERROR')      return t('inspection.analysisFailedConfig',  { defaultValue: fallbackDetail })
  if (reason === 'PROVIDER_OUTAGE')   return t('inspection.analysisFailedOutage',  { defaultValue: fallbackDetail })
  if (reason === 'PROVIDER_RESPONSE') return t('inspection.analysisFailedResponse', { defaultValue: fallbackDetail })
  if (reason === 'BAD_REQUEST')       return t('inspection.analysisFailedImage',   { defaultValue: fallbackDetail })
  return t('inspection.analysisFailedUnknown', { defaultValue: fallbackDetail })
}

function friendlyAIReasonLabel(reason: string | undefined, t: TFn): string {
  if (!reason) return ''
  return t(`inspection.failure.${reason}`, {
    defaultValue: t('inspection.failure.UNKNOWN', { defaultValue: 'Analysis issue' }),
  })
}

function photoNeedsRetake(photo: PhotoEntry | undefined): boolean {
  if (!photo?.aiResult || photo.aiPending) return false
  return !!photo.aiResult.failureReason || !deriveUsability(photo.aiResult).isUsable
}

function canRetryExistingPhoto(photo: PhotoEntry | undefined): boolean {
  return !!photo && photo.file.size > 0 && AI_PRIORITY_ANGLES.has(photo.key)
}

function photoStatusLabel(photo: PhotoEntry | undefined, t: TFn): { text: string; color: string; bg: string; border: string } | null {
  if (!photo) return null
  if (photo.aiPending) {
    return {
      text: t('inspection.statusAnalyzing', { defaultValue: 'Analyzing...' }),
      color: '#22d3ee',
      bg: 'rgba(34,211,238,0.12)',
      border: 'rgba(34,211,238,0.28)',
    }
  }
  if (photoNeedsRetake(photo)) {
    return {
      text: t('inspection.statusNeedsRetake', { defaultValue: 'Needs retake' }),
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.13)',
      border: 'rgba(239,68,68,0.28)',
    }
  }
  if (photo.aiResult) {
    return {
      text: t('inspection.statusAnalyzed', { defaultValue: 'Analyzed' }),
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.25)',
    }
  }
  return null
}

async function enqueueAIAnalysis<T>(task: () => Promise<T>): Promise<T> {
  const run = aiAnalysisQueue.then(task, task)
  aiAnalysisQueue = run.catch(() => undefined)
  return run
}

// ─── Photo draft persistence (survives refresh / navigation) ──────────────────
const PHOTO_DRAFT_KEY   = 'uci-photo-drafts'
const AI_CONSENT_KEY    = 'uci-ai-consent'

function readAiConsent(): boolean {
  try { return localStorage.getItem(AI_CONSENT_KEY) === 'true' } catch { return false }
}
function writeAiConsent(): void {
  try { localStorage.setItem(AI_CONSENT_KEY, 'true') } catch { /* quota */ }
}

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

function scrollElementToTop(el: HTMLElement | null) {
  if (!el) return
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({
    block: 'start',
    inline: 'nearest',
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
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
      errorType: err instanceof Error ? err.name : 'unknown',
    }, false)
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

type TFn = (key: string, opts?: Record<string, unknown>) => string

// Failure reasons from the server that are worth retrying on the client
const RETRIABLE_SERVER_FAILURES = new Set(['RATE_LIMIT', 'TIMEOUT', 'PROVIDER_OUTAGE'])
const KNOWN_AI_FAILURES = new Set([
  'CONFIG_ERROR',
  'RATE_LIMIT',
  'TIMEOUT',
  'BAD_REQUEST',
  'IMAGE_VALIDATION',
  'PROVIDER_OUTAGE',
  'PROVIDER_RESPONSE',
  'UNKNOWN',
])

function classifyClientAIFailure(reason: string): string {
  if (KNOWN_AI_FAILURES.has(reason)) return reason
  if (reason.includes('decode') || reason.includes('Unsupported') || reason.includes('dimensions')) return 'IMAGE_VALIDATION'
  if (reason === 'NETWORK_ERROR') return 'TIMEOUT'
  if (reason.startsWith('AI response was not JSON')) return 'PROVIDER_RESPONSE'
  return 'UNKNOWN'
}

// clientRequestId is generated once per photo analysis by the caller (analyzePhotoEntry)
// and flows through every log entry and the x-request-id request header so that
// client logs and server logs for the same photo share the same identifier.
async function runAI(key: string, label: string, file: File, fallbackSignal: string, fallbackDetail: string, locale: string, tFn: TFn, clientRequestId: string): Promise<MockAIResult> {
  const startedAt = Date.now()
  try {
    logPhotoFlow('ai_prepare_started', { key, label, originalSize: file.size, originalType: file.type }, true, clientRequestId)
    if (!file.type.startsWith('image/')) {
      logPhotoFlow('ai_rejected_invalid_type', { key, fileType: file.type }, false, clientRequestId)
      throw new Error('IMAGE_VALIDATION')
    }
    const prepared = await prepareImageForAI(file)
    if (prepared.size > MAX_CLIENT_IMAGE_BYTES) {
      logPhotoFlow('ai_rejected_oversized', { key, preparedSize: prepared.size, limitBytes: MAX_CLIENT_IMAGE_BYTES }, false, clientRequestId)
      throw new Error('IMAGE_VALIDATION')
    }
    logPhotoFlow('ai_prepare_finished', {
      key,
      preparedSize: prepared.size,
      width: prepared.width,
      height: prepared.height,
      mimeType: prepared.mimeType,
    }, true, clientRequestId)

    const requestBody = {
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
    }

    // Outer retry loop — handles transient server-side failures (RATE_LIMIT, TIMEOUT)
    // that the server returns as HTTP 200 with failureReason in the response body.
    for (let clientAttempt = 1; clientAttempt <= AI_MAX_ATTEMPTS; clientAttempt += 1) {
      const res = await enqueueAIAnalysis(async () => {
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)
        try {
          logPhotoFlow('ai_request_sent', { key, label, clientAttempt }, true, clientRequestId)
          const response = await fetch('/api/inspection/analyze-photo', {
            method:      'POST',
            signal:      controller.signal,
            credentials: 'include',
            headers:     {
              'Content-Type': 'application/json',
              'x-request-id': clientRequestId,
            },
            body:        JSON.stringify(requestBody),
          })
          return response
        } catch (err) {
          const timedOut = err instanceof DOMException && err.name === 'AbortError'
          throw new Error(timedOut ? 'TIMEOUT' : 'NETWORK_ERROR')
        } finally {
          window.clearTimeout(timeout)
        }
      })

      const raw = await res.text()
      let json: { data?: MockAIResult; message?: string; error?: string; requestId?: string } | null = null
      try {
        json = raw ? JSON.parse(raw) : null
      } catch {
        throw new Error(`AI response was not JSON (${res.status})`)
      }

      // Use server-confirmed requestId when echoed back; otherwise keep the client-generated one.
      // This ensures the post-response log uses whichever id the server actually logged under.
      const effectiveRequestId = json?.data?.requestId ?? json?.requestId ?? clientRequestId

      logPhotoFlow('ai_response_received', {
        key, status: res.status, clientAttempt,
        durationMs: Date.now() - startedAt, hasData: !!json?.data,
        failureReason: json?.data?.failureReason,
      }, true, effectiveRequestId)

      if (json?.data) {
        const failureReason = json.data.failureReason
        // Retry silently on transient server failures if we have remaining attempts.
        // Jitter prevents multiple images from retrying in lockstep after a rate-limit event.
        if (failureReason && RETRIABLE_SERVER_FAILURES.has(failureReason) && clientAttempt < AI_MAX_ATTEMPTS) {
          const delay = 700 + Math.floor(Math.random() * 400) // 700–1100 ms
          logPhotoFlow('ai_client_retry_on_transient', { key, clientAttempt, failureReason, delayMs: delay }, true, clientRequestId)
          await sleep(delay)
          continue
        }
        logPhotoFlow('ai_parse_result', {
          key,
          severity: json.data.severity,
          imageQuality: json.data.imageQuality,
          confidenceScore: json.data.confidenceScore,
          detectedIssues: json.data.detectedIssues?.length ?? 0,
          possibleIssues: json.data.possibleIssues?.length ?? 0,
          failureReason,
        }, true, effectiveRequestId)
        // T5.3: When the server signals a failure, re-apply the client i18n system to
        // produce the specific localized detail message. The server only has specific
        // non-English text for RATE_LIMIT / TIMEOUT / CONFIG_ERROR; for all other
        // failure reasons in non-English locales, the server returns a generic fallback.
        // The client i18n files have specific keys for every failure reason in all 6
        // locales, so running through friendlyAIDetail() here gives better messages
        // for BAD_REQUEST, IMAGE_VALIDATION, PROVIDER_OUTAGE, PROVIDER_RESPONSE, and
        // all Bulgarian (bg) locale failures regardless of the failure type.
        // Successful responses (failureReason absent) are returned unchanged.
        if (failureReason) {
          return {
            ...json.data,
            detail: friendlyAIDetail(json.data.detail ?? fallbackDetail, failureReason, tFn),
          }
        }
        return json.data
      }
      if (res.status === 429) throw new Error('RATE_LIMIT')
      throw new Error(json?.message ?? json?.error ?? `HTTP_${res.status}`)
    }

    // Exhausted all client attempts — should not reach here in practice
    throw new Error('RATE_LIMIT')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    const friendlyReason = classifyClientAIFailure(reason)
    logPhotoFlow('ai_failure', { key, failureReason: friendlyReason, durationMs: Date.now() - startedAt }, false, clientRequestId)
    // T5.3: Classify client-thrown errors into known AIProviderFailure codes so
    // the badge label and detail message are specific rather than falling through
    // to the generic UNKNOWN / "Analysis issue" fallback.
    //   NETWORK_ERROR   → TIMEOUT   (connectivity issue; same retake advice applies)
    //   non-JSON body   → PROVIDER_RESPONSE (incomplete / unexpected server output)
    //   image decode    → IMAGE_VALIDATION (unchanged from before)
    return {
      signal: fallbackSignal,
      severity: 'warn',
      detail: friendlyAIDetail(fallbackDetail, friendlyReason, tFn),
      imageQuality: 'unusable',
      visibleAreas: [],
      detectedIssues: [],
      possibleIssues: [],
      uncertainAreas: [tFn('inspection.aiDidNotComplete', { defaultValue: 'AI analysis did not complete' })],
      confidenceScore: 0,
      recommendation: tFn('inspection.analysisRetakeAdvice', { defaultValue: 'Retake the photo or try again with a stable network connection.' }),
      failureReason: friendlyReason,
      isUsable: false,
      usabilityReason: 'LOW_QUALITY',
      requestId: clientRequestId,
    }
  }
}

// ─── AI Badge ─────────────────────────────────────────────────────────────────
function AIBadge({ result }: Readonly<{ result: MockAIResult }>) {
  const { t } = useTranslation()
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
  const failureLabel = friendlyAIReasonLabel(result.failureReason, t as TFn)
  return (
    <div style={{ padding: '8px 10px', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, marginTop: 8, display: 'flex', gap: 8 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0, marginTop: 3 }} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{result.signal}</div>
          {/* Show imageQuality badge only on success, not on failures (redundant with failure message) */}
          {result.imageQuality && !result.failureReason && result.imageQuality !== 'good' && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              color: result.imageQuality === 'unusable' ? '#f59e0b' : 'rgba(255,255,255,0.42)',
              border: `1px solid ${result.imageQuality === 'unusable' ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 4,
              padding: '1px 5px',
            }}>
              {t(`inspection.imgQuality.${result.imageQuality}`, { defaultValue: result.imageQuality })}
            </span>
          )}
          {result.failureReason && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 4,
              padding: '1px 5px',
            }}>
              {failureLabel}
            </span>
          )}
          {/* Confidence level badge on successful analysis */}
          {!result.failureReason && result.confidenceScore !== undefined && result.confidenceScore > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 600,
              color: result.confidenceScore >= 70 ? '#22c55e' : result.confidenceScore >= 45 ? '#f59e0b' : 'rgba(255,255,255,0.38)',
              border: `1px solid ${result.confidenceScore >= 70 ? 'rgba(34,197,94,0.2)' : result.confidenceScore >= 45 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 4,
              padding: '1px 5px',
            }}>
              {result.confidenceScore >= 70 ? t('inspection.confidence.high') : result.confidenceScore >= 45 ? t('inspection.confidence.medium') : t('inspection.confidence.low')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{result.detail}</div>
        {visibleAreas.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'rgba(255,255,255,0.34)', lineHeight: 1.45 }}>
            {t('inspection.aiVisible')}: {visibleAreas.join(', ')}
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
        {result.recommendation && !result.failureReason && result.severity !== 'ok' && (
          <div style={{ marginTop: 6, fontSize: 10.5, color: 'rgba(34,211,238,0.65)', lineHeight: 1.45, borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 5 }}>
            {result.recommendation}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Compact photo card (used inside the grid rows) ──────────────────────────
function CompactPhotoCard({ angle, photo, onAdd }: Readonly<{
  angle: { key: string; label: string; hint: string }
  photo: PhotoEntry | undefined
  onAdd: (key: string, label: string) => void
}>) {
  const { t } = useTranslation()
  const label = t(`angle.${angle.key}`, { defaultValue: angle.label })
  const isFailed     = !!(photo?.aiResult?.failureReason && !photo?.aiPending)
  const hasResult    = !!(photo?.aiResult && !photo?.aiPending)
  const sev          = photo?.aiResult?.severity
  const isUnusable   = hasResult && photo?.aiResult ? !deriveUsability(photo.aiResult).isUsable : false
  const status       = photoStatusLabel(photo, t as TFn)
  const borderColor  = hasResult && !isFailed
    ? isUnusable ? 'rgba(239,68,68,0.55)'
    : sev === 'flag' ? 'rgba(239,68,68,0.55)' : sev === 'warn' ? 'rgba(245,158,11,0.45)' : 'rgba(34,197,94,0.45)'
    : photo ? 'rgba(34,211,238,0.22)' : 'rgba(255,255,255,0.08)'
  const dotColor     = isUnusable ? '#ef4444' : isFailed ? '#f59e0b' : sev === 'flag' ? '#ef4444' : sev === 'warn' ? '#f59e0b' : '#22c55e'

  return (
    <button
      onClick={() => onAdd(angle.key, label)}
      aria-label={photo ? `Retake ${label}` : `Capture ${label}`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        minHeight: 44,
        padding: 0, background: 'transparent', border: 'none', cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: '100%', aspectRatio: '4/3', borderRadius: 10, overflow: 'hidden',
        position: 'relative',
        background: photo ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${borderColor}`,
        transition: 'border-color 0.15s',
      }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.previewUrl}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        )}

        {/* AI loading spinner */}
        {photo?.aiPending && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* AI status dot */}
        {hasResult && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            width: 7, height: 7, borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 5px ${dotColor}`,
          }} />
        )}

        {/* Unusable photo overlay — shown when vehicle not visible */}
        {isUnusable && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 9,
            background: 'rgba(239,68,68,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
        )}

        {status && (
          <div style={{
            position: 'absolute', left: 4, bottom: 4,
            maxWidth: 'calc(100% - 32px)',
            padding: '2px 5px',
            borderRadius: 5,
            background: status.bg,
            border: `1px solid ${status.border}`,
            backdropFilter: 'blur(4px)',
          }}>
            <span style={{
              display: 'block',
              fontSize: 9,
              fontWeight: 700,
              lineHeight: 1.25,
              color: status.color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {status.text}
            </span>
          </div>
        )}

        {/* Retake icon (bottom-right) */}
        {photo && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 20, height: 20, borderRadius: 5,
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </div>
        )}

        {/* Camera icon for empty slots */}
        {!photo && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            width: 20, height: 20, borderRadius: 5,
            background: 'rgba(34,211,238,0.12)',
            border: '1px solid rgba(34,211,238,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 10, fontWeight: 600, lineHeight: 1.3,
        color: photo ? '#fff' : 'rgba(255,255,255,0.45)',
        textAlign: 'center', width: '100%',
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {label}
      </div>
    </button>
  )
}

// ─── Photo Grid ───────────────────────────────────────────────────────────────
function PhotoGrid({ photos, onAdd, onRetry }: Readonly<{
  photos: PhotoEntry[]
  onAdd: (key: string, label: string) => void
  onRetry: (key: string) => void
}>) {
  const { t } = useTranslation()
  const captured = photos.length
  const total    = PHOTO_ANGLES.length
  const analyzed = photos.filter(p => p.aiResult && !p.aiPending).length
  const needsRetake = photos.filter(photoNeedsRetake).length

  return (
    <div>
      {/* Progress summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
            {t('inspection.photosAnalyzedCount', { count: analyzed, total, defaultValue: '{{count}} / {{total}} photos analyzed' })}
          </div>
          <div style={{ fontSize: 11, color: needsRetake > 0 ? '#f59e0b' : 'rgba(255,255,255,0.38)', marginTop: 2, lineHeight: 1.35 }}>
            {needsRetake > 0
              ? t('inspection.photosNeedRetakeCount', { count: needsRetake, defaultValue: '{{count}} need retake or retry' })
              : t('inspection.photosCaptured', { count: captured, total })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 80, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(analyzed / total) * 100}%`, background: needsRetake > 0 ? '#f59e0b' : '#22d3ee', borderRadius: 2, transition: 'width 0.3s ease' }} />
          </div>
          <span style={{ fontSize: 11, color: '#22d3ee', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>
            {Math.round((analyzed / total) * 100)}%
          </span>
        </div>
      </div>

      {/* 3-row grid: Front (3-col) → Sides (2-col) → Rear (3-col) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PHOTO_ROWS.map(row => {
          const rowItems = row.angles.map(key => ({
            angle: PHOTO_ANGLES.find(a => a.key === key)!,
            photo: photos.find(p => p.key === key),
          }))
          const capturedInRow = rowItems.filter(({ photo }) => !!photo)
          const resultsInRow  = rowItems.filter(({ photo }) => photo?.aiResult && !photo?.aiPending)

          return (
            <div key={row.rowKey}>
              {/* Row header */}
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
                color: 'rgba(255,255,255,0.28)',
                marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {t(row.labelKey)}
                {capturedInRow.length > 0 && (
                  <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>
                    {capturedInRow.length}/{row.angles.length}
                  </span>
                )}
              </div>

              {/* Compact thumbnail grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${row.cols}, 1fr)`,
                gap: 8,
              }}>
                {rowItems.map(({ angle, photo }) => (
                  <CompactPhotoCard key={angle.key} angle={angle} photo={photo} onAdd={onAdd} />
                ))}
              </div>

              {/* AI analysis results for this row (only when available) */}
              {resultsInRow.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {resultsInRow.map(({ angle, photo }) => {
                    const needsRetakeForPhoto = photoNeedsRetake(photo)
                    const retryAvailable = canRetryExistingPhoto(photo)
                    return (
                    <div key={angle.key}>
                      <div style={{
                        fontSize: 9.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                        color: 'rgba(255,255,255,0.25)', marginBottom: 3,
                      }}>
                        {t(`angle.${angle.key}`, { defaultValue: angle.label })}
                      </div>
                      <AIBadge result={photo!.aiResult!} />
                    {needsRetakeForPhoto && (
                      <div style={{
                        marginTop: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                        padding: '7px 8px',
                        background: 'rgba(239,68,68,0.07)',
                        border: '1px solid rgba(239,68,68,0.22)',
                        borderRadius: 6,
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
                          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        <span style={{ fontSize: 10.5, color: '#ef4444', lineHeight: 1.4, flex: 1, minWidth: 0 }}>
                          {t('inspection.unusableRetake', { defaultValue: 'Vehicle not clearly visible — please retake this shot' })}
                        </span>
                      </div>
                    )}
                    {needsRetakeForPhoto && (
                      <button
                        type="button"
                        onClick={() => retryAvailable ? onRetry(photo!.key) : onAdd(angle.key, t(`angle.${angle.key}`, { defaultValue: angle.label }))}
                        disabled={photo?.aiPending}
                        style={{
                          minHeight: 40,
                          marginTop: 6,
                          padding: '0 12px',
                          borderRadius: 9,
                          border: '1px solid rgba(239,68,68,0.35)',
                          background: 'rgba(239,68,68,0.12)',
                          color: '#fca5a5',
                          fontSize: 11.5,
                          fontWeight: 800,
                          fontFamily: 'var(--font-sans)',
                          cursor: photo?.aiPending ? 'wait' : 'pointer',
                        }}
                      >
                        {retryAvailable
                          ? t('inspection.retryAnalysis', { defaultValue: 'Retry analysis' })
                          : t('inspection.retakePhoto', { defaultValue: 'Retake photo' })}
                      </button>
                    )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Checklist Phase ──────────────────────────────────────────────────────────
function ChecklistPhase({ items, isLoading, sectionCategory, onStatus, onNotes }: Readonly<{
  items: ChecklistRow[]
  isLoading: boolean
  sectionCategory?: ChecklistCategory
  onStatus: (id: string, st: ItemStatus) => void
  onNotes:  (id: string, notes: string) => void
}>) {
  const { t } = useTranslation()
  const isConditionSection = sectionCategory === 'EXTERIOR' || sectionCategory === 'INTERIOR'

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
                <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.46)', lineHeight: 1.6, margin: '-3px 0 12px', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
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
                  const labels: Record<ItemStatus, string> = isConditionSection
                    ? {
                        PENDING: '',
                        OK: t('inspection.condition.good'),
                        WARNING: t('inspection.condition.fair'),
                        PROBLEM: t('inspection.condition.poor'),
                      }
                    : {
                        PENDING: '',
                        OK: t('inspection.diagnostic.ok'),
                        WARNING: t('inspection.diagnostic.warning'),
                        PROBLEM: t('inspection.diagnostic.problem'),
                      }
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
function RiskAnalysisPhase({
  photos,
  inspectionComplete,
  answeredCount,
  totalCount,
  missingSections,
}: Readonly<{
  photos: PhotoEntry[]
  inspectionComplete: boolean
  answeredCount: number
  totalCount: number
  missingSections: string[]
}>) {
  const { t }    = useTranslation()
  const total        = PHOTO_ANGLES.length
  const analyzed     = photos.filter(p => p.aiResult && !p.aiPending)
  const failed       = analyzed.filter(p => p.aiResult?.failureReason)
  const unusable     = analyzed.filter(p => photoNeedsRetake(p) && !p.aiResult?.failureReason)
  const flagged      = analyzed.filter(p => p.aiResult && !photoNeedsRetake(p) && p.aiResult.severity !== 'ok')
  const clean        = analyzed.filter(p => p.aiResult && !photoNeedsRetake(p) && p.aiResult.severity === 'ok')
  const missing      = total - analyzed.length
  const isPartial    = failed.length > 0 || unusable.length > 0 || missing > 0
  const successCount = analyzed.length - failed.length - unusable.length
  // Thresholds scaled for 8-image set: 7+ = high, 5+ = medium, <5 = low
  const confidenceLevel: 'high' | 'medium' | 'low' = successCount >= 7 ? 'high' : successCount >= 5 ? 'medium' : 'low'
  const confidenceColor = successCount >= 7 ? '#22c55e' : successCount >= 5 ? '#f59e0b' : 'rgba(255,255,255,0.32)'

  return (
    <div>
      {photos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t('inspection.photoAnalysisSummary')}
            </div>
            {/* Analyzed count + confidence badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 10.5, color: isPartial ? '#f59e0b' : 'rgba(255,255,255,0.38)', fontWeight: 600 }}>
                {t('inspection.analyzedCount', { count: analyzed.length, total })}
              </div>
              {analyzed.length > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                  color: confidenceColor,
                  border: `1px solid ${confidenceColor}55`,
                  background: `${confidenceColor}12`,
                  letterSpacing: '0.02em',
                }}>
                  {t(`inspection.confidence.${confidenceLevel}`)}
                </span>
              )}
            </div>
          </div>

          {/* Partial analysis notice */}
          {isPartial && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 9, marginBottom: 10 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                {t('inspection.partialAccuracyWarning', {
                  defaultValue: 'Some angles are missing or unclear - this may affect accuracy.',
                  failed: failed.length,
                  missing,
                  unusable: unusable.length,
                })}
              </span>
            </div>
          )}

          {flagged.length === 0 && failed.length === 0 && analyzed.length > 0 ? (() => {
            const coverageRatio = analyzed.length / total
            if (coverageRatio < 0.3) {
              // Very limited coverage — never show a green "no issues" box.
              return (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '9px 12px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 9 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    {t('inspection.noFlagsVeryLimited', { defaultValue: 'No issues in the analyzed photos, but most of the vehicle was not covered. Upload more photos for reliable results.' })}
                  </span>
                </div>
              )
            }
            if (coverageRatio < 0.5) {
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 10 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <div>
                    <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{t('inspection.noFlagsPartialCoverage', { defaultValue: 'No issues detected in the analyzed photos. Partial coverage — results may not represent the full vehicle condition.' })}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      {t('inspection.analyzedCount', { count: analyzed.length, total })}
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 10 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <div>
                  <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>{t('inspection.noFlagsRaised')}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {!isPartial && analyzed.length === total
                      ? t('inspection.analysisFull', { total })
                      : t('inspection.analyzedCount', { count: clean.length, total })}
                  </div>
                </div>
              </div>
            )
          })() : (
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
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{p.aiResult?.signal}</div>
                  </div>
                </div>
              ))}
              {failed.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{t('inspection.analysisCouldNotComplete')}</div>
                  </div>
                </div>
              ))}
              {unusable.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 10 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 3 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{t('inspection.statusNeedsRetake', { defaultValue: 'Needs retake' })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {photos.length > 0 && <PhotoAnalysisDisclaimer style={{ marginBottom: 16 }} />}

      <div style={{ padding: '12px 0 4px' }}>
        {inspectionComplete ? (
          <>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
              {t('inspection.allPhasesComplete')}
            </div>
            {isPartial && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 10, marginBottom: 12 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.58)', lineHeight: 1.5 }}>
                  {t('inspection.partialAccuracyWarning', { defaultValue: 'Some angles are missing or unclear - this may affect accuracy.' })}
                </span>
              </div>
            )}
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
          </>
        ) : (
          <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, rgba(34,211,238,0.05), rgba(255,255,255,0.02))', border: '1px solid rgba(34,211,238,0.1)', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              {t('report.noScorePendingTitle', { defaultValue: 'Ocena jos nije dostupna' })}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
              {t('report.noScorePendingSub', { defaultValue: 'Pregled nije u potpunosti zavrsen. Mozete generisati preliminarni izvestaj, ali nedostajuce stavke mogu uticati na tacnost i potpunost rezultata.' })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.78)' }}>
                {t('report.progressComplete', {
                  defaultValue: 'Zavrseno: {{done}} od {{total}} stavki',
                  done: answeredCount,
                  total: totalCount,
                })}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#22d3ee', whiteSpace: 'nowrap' }}>
                {t('report.progressPercent', {
                  defaultValue: '{{percent}}% zavrseno',
                  percent: totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0,
                })}
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}>
              <div style={{
                height: '100%',
                width: `${totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0}%`,
                background: 'linear-gradient(90deg, #22d3ee 0%, #67e8f9 60%, #a5f3fc 100%)',
                boxShadow: '0 0 18px rgba(34,211,238,0.35)',
                borderRadius: 999,
                transition: 'width 0.35s ease',
              }} />
            </div>
            {missingSections.length > 0 && (
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                {t('report.progressMissing', {
                  defaultValue: 'Nedostaju: {{sections}}',
                  sections: missingSections.join(', ').toLowerCase(),
                })}
              </div>
            )}
            <Link
              href="/report?mode=preliminary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
                padding: '13px 0',
                background: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)',
                color: '#041014',
                borderRadius: 12,
                fontSize: 13.5,
                fontWeight: 800,
                textDecoration: 'none',
                letterSpacing: '-0.15px',
                boxShadow: '0 10px 26px rgba(34,211,238,0.18)',
              }}
            >
              {t('report.generatePreliminaryReport', { defaultValue: 'Generisi preliminarni izvestaj' })}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function InspectionPage() {
  const { t, i18n }       = useTranslation()
  const searchParams      = useSearchParams()
  const { activeVehicle } = useVehicleStore()
  const {
    session, currentPhase, checklistItems, isLoadingChecklist, error,
    initSession, setPhase, updateChecklistItem, getItemsByCategory, pushAIResult,
  } = useInspectionStore()

  const [photos, setPhotos]             = useState<PhotoEntry[]>([])
  const [cameraTarget, setCameraTarget] = useState<{ key: string; label: string; shotNumber: number } | null>(null)
  const [findingsSaved, setFindingsSaved] = useState(false)
  const [aiConsentAccepted, setAiConsentAccepted] = useState<boolean>(readAiConsent)
  const [showConsentModal,  setShowConsentModal]  = useState(false)
  const pendingCameraRef = useRef<{ key: string; label: string } | null>(null)
  const phaseCardRef = useRef<HTMLDivElement>(null)
  const previousPhaseRef = useRef<InspectionPhase | null>(null)
  const previousVehicleIdRef = useRef<string | null>(null)
  const appliedFocusRef = useRef<string | null>(null)
  const focusPhase = useMemo<InspectionPhase | null>(() => {
    const requestedPhase = searchParams.get('focus')
    if (!requestedPhase) return null
    return PHASES.some(({ phase }) => phase === requestedPhase)
      ? requestedPhase as InspectionPhase
      : null
  }, [searchParams])

  useEffect(() => {
    if (!activeVehicle?.id) return
    const previousVehicleId = previousVehicleIdRef.current
    const isDifferentVehicle =
      (previousVehicleId !== null && previousVehicleId !== activeVehicle.id) ||
      (session?.vehicleId !== undefined && session.vehicleId !== activeVehicle.id)

    if (isDifferentVehicle) {
      setPhotos([])
      setFindingsSaved(false)
      setCameraTarget(null)
      setPhase('PRE_SCREENING')
    }
    previousVehicleIdRef.current = activeVehicle.id
    if (session?.vehicleId !== activeVehicle.id) initSession(activeVehicle.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVehicle?.id, session?.vehicleId])

  // Restore photo drafts when a persisted session is loaded (survives refresh / reopen)
  useEffect(() => {
    const vehicleId = session?.vehicleId
    if (!vehicleId) return
    const drafts = loadPhotoDrafts(vehicleId)
    if (drafts.length === 0) {
      setPhotos([])
      setFindingsSaved(false)
      return
    }
    const withCachedAI = drafts.filter(d => d.aiResult).length
    if (withCachedAI > 0) {
      pipelineLog({ step: 'inspection/photos:restored-from-cache', requestId: generateRequestId(), success: true, durationMs: 0, meta: { vehicleId, totalPhotos: drafts.length, withCachedAIResult: withCachedAI } })
    }
    setPhotos(drafts.map(d => ({
      key:       d.key,
      label:     d.label,
      file:      new File([], d.key, { type: 'image/jpeg' }), // placeholder — AI already done
      previewUrl: d.thumbUrl,
      aiPending: false,
      aiResult:  d.aiResult,
    })))
    setFindingsSaved(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.vehicleId])

  useEffect(() => {
    if (previousPhaseRef.current && previousPhaseRef.current !== currentPhase) {
      window.requestAnimationFrame(() => scrollElementToTop(phaseCardRef.current))
    }
    previousPhaseRef.current = currentPhase
  }, [currentPhase])

  useEffect(() => {
    if (!focusPhase) return
    const focusKey = `${activeVehicle?.id ?? session?.vehicleId ?? 'no-vehicle'}:${focusPhase}`
    if (appliedFocusRef.current === focusKey) return

    if (currentPhase !== focusPhase) {
      setPhase(focusPhase)
    }
    appliedFocusRef.current = focusKey
  }, [activeVehicle?.id, currentPhase, focusPhase, session?.vehicleId, setPhase])

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

    const photoResults = completed.map(p => {
      const usable = deriveUsability(p.aiResult!)
      return {
        angle:          p.key,
        label:          p.label,
        signal:         p.aiResult!.signal,
        severity:       p.aiResult!.severity,
        detail:         p.aiResult!.detail,
        // Force confidence to 0 for unusable photos so their "findings" are
        // filtered by the existing r.confidence >= 45 gate in ai-analysis/analyze.
        // This prevents an "unusable" signal from contributing a false finding.
        confidence:     usable.isUsable ? (p.aiResult!.confidenceScore ?? 80) : 0,
        recommendation: p.aiResult!.recommendation ?? '',
      }
    })

    const aggStart = Date.now()
    const batchRequestId = generateRequestId()
    pipelineLog({ step: 'inspection/ai-batch:aggregate-start', requestId: batchRequestId, success: true, durationMs: 0, meta: { vehicleId, photoCount: photoResults.length } })

    fetch('/api/ai-analysis/analyze', {
      method:      'POST',
      credentials: 'include',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify({ vehicleId, photoResults }),
    })
      .then(r => r.json())
      .then(json => {
        pipelineLog({ step: 'inspection/ai-batch:aggregate-complete', requestId: batchRequestId, success: true, durationMs: Date.now() - aggStart, meta: { vehicleId, photoCount: photoResults.length, findingsCount: json?.data?.findings?.length ?? 0 } })
        if (json?.data) pushAIResult(json.data)
      })
      .catch(err => pipelineLog({ step: 'inspection/ai-batch:aggregate-failed', requestId: batchRequestId, success: false, durationMs: Date.now() - aggStart, meta: { vehicleId, photoCount: photoResults.length, errorType: err instanceof Error ? err.name : 'unknown' } }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPhase])

  const phaseIdx  = PHASES.findIndex(p => p.phase === currentPhase)
  const phaseCfg  = PHASES[phaseIdx]
  const items     = phaseCfg?.category ? getItemsByCategory(phaseCfg.category) : []
  const inspectionCompletion = useMemo(() => getInspectionCompletion(checklistItems), [checklistItems])
  const checked   = inspectionCompletion.answeredCount
  const total     = inspectionCompletion.totalCount
  const progress  = total > 0 ? Math.round((checked / total) * 100) : 0
  const checklistDiagnostics = useMemo(() => getChecklistDiagnostics(checklistItems), [checklistItems])
  const missingSectionLabels = useMemo(
    () => inspectionCompletion.missingCategories.map((category) => category === 'DOCUMENTS' ? t('phase.VIN_DOCS') : t(`phase.${category}`)),
    [inspectionCompletion.missingCategories, t],
  )

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const diagnosticsOk = checklistDiagnostics.duplicateItemCount === 0 &&
      checklistDiagnostics.obsoleteKeys.length === 0 &&
      checklistDiagnostics.missingCanonicalKeys.length === 0
    pipelineLog({ step: 'inspection/checklist:diagnostics', requestId: generateRequestId(), success: diagnosticsOk, durationMs: 0, meta: checklistDiagnostics as unknown as Record<string, unknown> })
  }, [checklistDiagnostics])

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

  const handleConsentAccept = useCallback(() => {
    writeAiConsent()
    setAiConsentAccepted(true)
    setShowConsentModal(false)
    const pending = pendingCameraRef.current
    pendingCameraRef.current = null
    if (pending) {
      logPhotoFlow('capture_flow_opened', { key: pending.key, label: pending.label })
      const shotNumber = PHOTO_ANGLES.findIndex(a => a.key === pending.key) + 1
      setCameraTarget({ key: pending.key, label: pending.label, shotNumber })
    }
  }, [])

  const handleOpenCamera = useCallback((key: string, label: string) => {
    if (!aiConsentAccepted) {
      pendingCameraRef.current = { key, label }
      setShowConsentModal(true)
      return
    }
    logPhotoFlow('capture_flow_opened', { key, label })
    const shotNumber = PHOTO_ANGLES.findIndex(a => a.key === key) + 1
    setCameraTarget({ key, label, shotNumber })
  }, [aiConsentAccepted])

  const analyzePhotoEntry = useCallback(async (entry: PhotoEntry, thumbUrl: string, force = false) => {
    const vehicleId = session?.vehicleId
    const existing = photos.find(p => p.key === entry.key)
    if (!force && existing?.aiResult && existing.previewUrl === entry.previewUrl) {
      logPhotoFlow('ai_result_reused', { key: entry.key, reason: 'existing_result_same_photo' })
      setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, aiPending: false, aiResult: existing.aiResult } : p))
      return existing.aiResult
    }

    setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, aiPending: true } : p))
    const locale = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0]
    const clientRequestId = generateRequestId()
    const result = await runAI(entry.key, entry.label, entry.file, t('inspection.analysisUnavailable'), t('inspection.analysisError'), locale, t as TFn, clientRequestId)
    setPhotos(prev => prev.map(p => p.key === entry.key ? { ...p, aiPending: false, aiResult: result } : p))
    const effectiveRequestId = result.requestId ?? clientRequestId
    logPhotoFlow('ai_result_applied', { key: entry.key, severity: result.severity, failureReason: result.failureReason, isUsable: result.isUsable }, true, effectiveRequestId)

    if (vehicleId && thumbUrl) {
      logPhotoFlow('upload_started', { key: entry.key, vehicleId, target: 'local_draft_with_ai' })
      savePhotoDraft({ vehicleId, key: entry.key, label: entry.label, thumbUrl, aiResult: result })
      logPhotoFlow('upload_finished', { key: entry.key, vehicleId, target: 'local_draft_with_ai' })
    }
    return result
  }, [i18n.language, i18n.resolvedLanguage, photos, session?.vehicleId, t])

  const handleRetryAnalysis = useCallback(async (key: string) => {
    const photo = photos.find(p => p.key === key)
    if (!photo) return
    if (!canRetryExistingPhoto(photo)) {
      handleOpenCamera(photo.key, photo.label)
      return
    }
    const thumbUrl = await toThumbnailDataUrl(photo.file)
    await analyzePhotoEntry(photo, thumbUrl || photo.previewUrl, true)
  }, [analyzePhotoEntry, handleOpenCamera, photos])

  const handleCapture = useCallback(async (file: File, previewUrl: string) => {
    if (!cameraTarget) return
    logPhotoFlow('confirm_received', { key: cameraTarget.key, label: cameraTarget.label, size: file.size, type: file.type })
    const isPriorityAngle = AI_PRIORITY_ANGLES.has(cameraTarget.key)
    const entry: PhotoEntry = { key: cameraTarget.key, label: cameraTarget.label, file, previewUrl, aiPending: isPriorityAngle }
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

    // Step 2: run AI analysis — only for the 5 priority angles
    // Non-priority photos (wheels, hood, roof, trunk, extra angles) are stored
    // but not sent to AI, preventing 429 errors and queue buildup.
    if (isPriorityAngle) {
      await analyzePhotoEntry(entry, thumbUrl)
    } else {
      // Non-priority angle — photo captured, AI skipped
      logPhotoFlow('ai_skipped_non_priority', { key: entry.key })
    }
  }, [analyzePhotoEntry, cameraTarget, session])

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
      {showConsentModal && <AiConsentModal onAccept={handleConsentAccept} />}

      {cameraTarget && (
        <CameraCapture
          label={cameraTarget.label}
          angleKey={cameraTarget.key}
          shotNumber={cameraTarget.shotNumber}
          totalShots={PHOTO_ANGLES.length}
          allAngles={PHOTO_ANGLES}
          completedKeys={photos.map(p => p.key)}
          onCapture={handleCapture}
          onClose={() => setCameraTarget(null)}
        />
      )}

      <div className="inspection-page-layout">

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
        <div ref={phaseCardRef} style={{
          background: currentPhase === 'AI_PHOTOS' ? 'transparent' : 'rgba(255,255,255,0.02)',
          border: currentPhase === 'AI_PHOTOS' ? '1px solid transparent' : '1px solid rgba(255,255,255,0.07)',
          borderRadius: 18,
          padding: '18px 16px',
          marginBottom: 12,
          boxShadow: currentPhase === 'AI_PHOTOS' ? 'none' : '0 1px 3px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
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
              <PhotoGrid photos={photos} onAdd={handleOpenCamera} onRetry={handleRetryAnalysis} />
              <PhotoAnalysisDisclaimer style={{ marginTop: 14 }} />
            </div>
          )}

          {/* RISK_ANALYSIS */}
          {currentPhase === 'RISK_ANALYSIS' && (
            <RiskAnalysisPhase
              photos={photos}
              inspectionComplete={inspectionCompletion.isComplete}
              answeredCount={inspectionCompletion.answeredCount}
              totalCount={inspectionCompletion.totalCount}
              missingSections={missingSectionLabels}
            />
          )}

          {/* All checklist phases */}
          {currentPhase !== 'AI_PHOTOS' && currentPhase !== 'RISK_ANALYSIS' && currentPhase !== 'PRE_SCREENING' && (
            <>
              <ChecklistPhase
                items={items}
                isLoading={isLoadingChecklist}
                sectionCategory={phaseCfg?.category}
                onStatus={handleStatus}
                onNotes={handleNotes}
              />
            </>
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
            {phaseIdx === PHASES.length - 2 ? t('inspection.finishAndScore') : t('inspection.startCta')}
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
