// =============================================================================
// Analyze Photo — POST /api/inspection/analyze-photo
// Sends a car photo to OpenAI Vision (gpt-4o) and returns structured findings.
//
// Pipeline steps (T5):
//   1. Auth
//   2. JSON parse
//   3. stepValidateRequest  — Zod schema
//   4. stepCheckImageSize   — 750 KB limit
//   5. stepCheckAngle       — must be a recognised inspection angle
//   6. stepGetApiKey        — OPENAI_API_KEY must be set
//   7. OpenAI API call w/ retry
//   8. Truncation recovery (condensed retry)
//   9. Parse & normalize AI response
//  10. Classify image usability
//  11. Build and return structured response
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { clampScore } from '@/modules/scoring/scoring.logic'
import { generateRequestId, pipelineLog } from '@/lib/logger'
import { pipelineOk, pipelineErr, type PipelineResult } from '@/lib/pipeline/types'

type IssueSeverity = 'minor' | 'moderate' | 'serious'
type ImageQuality = 'good' | 'medium' | 'poor' | 'unusable'
type LegacySeverity = 'ok' | 'warn' | 'flag'
type AIProviderFailure =
  | 'CONFIG_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'BAD_REQUEST'
  | 'IMAGE_VALIDATION'
  | 'PROVIDER_OUTAGE'
  | 'PROVIDER_RESPONSE'
  | 'UNKNOWN'

interface PhotoIssue {
  area: string
  issue: string
  severity: IssueSeverity
  confidence: number
}

interface StructuredPhotoAnalysis {
  imageQuality: ImageQuality
  visibleAreas: string[]
  detectedIssues: PhotoIssue[]
  possibleIssues: PhotoIssue[]
  uncertainAreas: string[]
  confidenceScore: number
  recommendation: string
  summary: string
}

const schema = z.object({
  imageBase64: z.string().min(100),
  mimeType:    z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  angle:       z.string().min(1),        // e.g. "FRONT", "LEFT_SIDE"
  angleLabel:  z.string().min(1),        // human label e.g. "Front"
  locale:      z.string().min(2).max(10).optional().default('en'),
  imageMeta: z.object({
    width:        z.number().positive().optional(),
    height:       z.number().positive().optional(),
    size:         z.number().positive().optional(),
    originalType: z.string().optional(),
    originalSize: z.number().positive().optional(),
  }).optional(),
})

// â”€â”€â”€ Prompt per angle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Image input limits ───────────────────────────────────────────────────────

/** Maximum decoded image size accepted after client-side compression (750 KB). */
const MAX_IMAGE_BYTES = 750 * 1024

/**
 * Angle-specific inspection focus strings.
 * Kept at module scope so SUPPORTED_ANGLES can be derived without duplication.
 */
const ANGLE_AREA_GUIDE: Record<string, string> = {
  FRONT:             'Focus on: bumper alignment, grille gaps, headlight symmetry, hood gap consistency, any paint colour mismatch.',
  FRONT_ANGLE_LEFT:  'Focus on: front-left corner impact markers, A-pillar condition, headlight fit, fender-bumper gap and alignment, paint tone match.',
  FRONT_ANGLE_RIGHT: 'Focus on: front-right corner impact markers, A-pillar condition, headlight fit, fender-bumper gap and alignment, paint tone match.',
  LEFT_SIDE:         'Focus on: door panel gaps, crease line continuity, paint tone across all panels, any ripple, waves, or filler signs, rocker panel condition.',
  RIGHT_SIDE:        'Focus on: door panel gaps, crease line continuity, paint tone across all panels, any ripple, waves, or filler signs, rocker panel condition.',
  REAR:              'Focus on: rear bumper alignment, tail-light symmetry, trunk/boot gap, colour tone vs quarter panels, tow-hitch area.',
  REAR_ANGLE_LEFT:   'Focus on: rear-left corner impact markers, C-pillar condition, tail-light fit, rear bumper-quarter panel gap, paint tone match.',
  REAR_ANGLE_RIGHT:  'Focus on: rear-right corner impact markers, C-pillar condition, tail-light fit, rear bumper-quarter panel gap, paint tone match.',
  FRONT_LEFT:        'Focus on: front-left corner impact markers, headlight fit, fender-bumper gap.',
  FRONT_RIGHT:       'Focus on: front-right corner impact markers, headlight fit, fender-bumper gap.',
  HOOD:              'Focus on: surface texture uniformity, paint tone vs fenders, any ripple, filler, or overspray near edges.',
  ROOF:              'Focus on: panel flatness, paint consistency, any dents or hail damage.',
  TRUNK:             'Focus on: boot/trunk lid gap symmetry, hinge alignment, paint match vs rear.',
  ENGINE_BAY:        'Focus on: fluid residue or stains (oil, coolant), corroded hoses or wiring, accident repair evidence, cleanliness vs mileage.',
  INTERIOR:          'Focus on: seat wear vs claimed mileage, dashboard cracks or sun damage, water ingress stains on carpet or headliner.',
  ODOMETER:          'Focus on: reading clearly, note the mileage value, flag if display looks tampered or reset.',
  VIN_PLATE:         'Focus on: plate condition, signs of tampering or re-stamping.',
  WHEELS_FL:         'Focus on: brake pad thickness visible through spokes, rotor condition, kerb damage on alloy.',
  WHEELS_FR:         'Focus on: brake pad thickness visible through spokes, rotor condition, kerb damage on alloy.',
  UNDERBODY:         'Focus on: rust patches, previous weld repairs, structural member condition, exhaust condition.',
}

/** All angle keys the server can meaningfully inspect. Any other value is rejected. */
const SUPPORTED_ANGLES = new Set(Object.keys(ANGLE_AREA_GUIDE))

type UsabilityReason = 'NOT_VEHICLE' | 'LOW_QUALITY' | 'UNCERTAIN' | 'OK'

/** Classify a successfully parsed AI response into usable / not-usable, no extra API calls. */
function classifyImageUsability(
  imageQuality: ImageQuality,
  confidenceScore: number,
  signal: string,
): { isUsable: boolean; usabilityReason: UsabilityReason } {
  if (imageQuality === 'unusable') {
    const sig = signal.toLowerCase()
    if (
      sig.includes('not inspectable') ||
      sig.includes('no vehicle') ||
      sig.includes('not a vehicle') ||
      sig.includes('no car')
    ) {
      return { isUsable: false, usabilityReason: 'NOT_VEHICLE' }
    }
    return { isUsable: false, usabilityReason: 'LOW_QUALITY' }
  }
  if (confidenceScore < 40) {
    return { isUsable: false, usabilityReason: 'UNCERTAIN' }
  }
  if (imageQuality === 'poor' && confidenceScore < 55) {
    return { isUsable: false, usabilityReason: 'LOW_QUALITY' }
  }
  return { isUsable: true, usabilityReason: 'OK' }
}

function localeInstruction(locale: string): string {
  const language: Record<string, string> = {
    en: 'English',
    sr: 'Serbian',
    de: 'German',
    mk: 'Macedonian',
    sq: 'Albanian',
    bg: 'Bulgarian',
  }
  return language[locale.split('-')[0]] ?? 'English'
}

function fallbackAnalysis(locale: string): { signal: string; detail: string } {
  const lang = locale.split('-')[0]
  const messages: Record<string, { signal: string; detail: string }> = {
    en: {
      signal: 'We couldn\'t analyze this photo.',
      detail: 'We had trouble analyzing this photo. Check your connection and try again.',
    },
    sr: {
      signal: 'Analiza nije dostupna',
      detail: 'Nije moguÄ‡e analizirati ovu fotografiju. Proverite vezu i pokuÅ¡ajte ponovo.',
    },
    de: {
      signal: 'Analyse nicht verfÃ¼gbar',
      detail: 'Dieses Bild konnte nicht analysiert werden. PrÃ¼fen Sie die Verbindung und versuchen Sie es erneut.',
    },
    mk: {
      signal: 'ÐÐ½Ð°Ð»Ð¸Ð·Ð°Ñ‚Ð° Ð½Ðµ Ðµ Ð´Ð¾ÑÑ‚Ð°Ð¿Ð½Ð°',
      detail: 'ÐÐµ Ð¼Ð¾Ð¶ÐµÑˆÐµ Ð´Ð° ÑÐµ Ð°Ð½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð° Ð¾Ð²Ð°Ð° Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸Ñ˜Ð°. ÐŸÑ€Ð¾Ð²ÐµÑ€ÐµÑ‚Ðµ Ñ˜Ð° Ð²Ñ€ÑÐºÐ°Ñ‚Ð° Ð¸ Ð¾Ð±Ð¸Ð´ÐµÑ‚Ðµ ÑÐµ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾.',
    },
    sq: {
      signal: 'Analiza nuk Ã«shtÃ« e disponueshme',
      detail: 'Nuk mundÃ«m ta analizonim kÃ«tÃ« fotografi. Kontrolloni lidhjen dhe provoni pÃ«rsÃ«ri.',
    },
    bg: {
      signal: 'ÐÐ½Ð°Ð»Ð¸Ð·ÑŠÑ‚ Ð½Ðµ Ðµ Ð½Ð°Ð»Ð¸Ñ‡ÐµÐ½',
      detail: 'ÐÐµ ÑƒÑÐ¿ÑÑ…Ð¼Ðµ Ð´Ð° Ð°Ð½Ð°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð¼Ðµ Ñ‚Ð°Ð·Ð¸ ÑÐ½Ð¸Ð¼ÐºÐ°. ÐŸÑ€Ð¾Ð²ÐµÑ€ÐµÑ‚Ðµ Ð²Ñ€ÑŠÐ·ÐºÐ°Ñ‚Ð° Ð¸ Ð¾Ð¿Ð¸Ñ‚Ð°Ð¹Ñ‚Ðµ Ð¾Ñ‚Ð½Ð¾Ð²Ð¾.',
    },
  }
  return messages[lang] ?? messages.en
}

function fallbackForFailure(locale: string, failure: AIProviderFailure): { signal: string; detail: string; recommendation: string } {
  const fallback = fallbackAnalysis(locale)
  const lang = locale.split('-')[0]
  const details: Record<string, Partial<Record<AIProviderFailure, string>>> = {
    en: {
      CONFIG_ERROR: 'AI photo analysis is temporarily unavailable. The rest of the report can still be completed.',
      RATE_LIMIT: 'AI photo analysis is temporarily busy. Please retry this photo in a moment.',
      TIMEOUT: 'AI photo analysis took too long. Please retry this photo when the connection is stable.',
      BAD_REQUEST: 'This photo could not be submitted for AI analysis. Retake it or choose another image.',
      IMAGE_VALIDATION: 'This image could not be processed. Retake it as a JPEG, PNG, or WebP image.',
      PROVIDER_OUTAGE: 'AI photo analysis is temporarily unavailable. Please retry shortly.',
      PROVIDER_RESPONSE: 'AI photo analysis returned an incomplete result. Please retry this photo.',
      UNKNOWN: fallback.detail,
    },
    sr: {
      RATE_LIMIT: 'AI analiza fotografija je trenutno zauzeta. PokuÅ¡ajte ponovo za trenutak.',
      TIMEOUT: 'AI analiza fotografije je predugo trajala. PokuÅ¡ajte ponovo kada je veza stabilna.',
      CONFIG_ERROR: 'AI analiza fotografija je trenutno nedostupna. Ostatak izveÅ¡taja i dalje moÅ¾ete zavrÅ¡iti.',
    },
    de: {
      RATE_LIMIT: 'Die KI-Fotoanalyse ist momentan ausgelastet. Bitte versuchen Sie es gleich erneut.',
      TIMEOUT: 'Die KI-Fotoanalyse hat zu lange gedauert. Bitte versuchen Sie es bei stabiler Verbindung erneut.',
      CONFIG_ERROR: 'Die KI-Fotoanalyse ist vorÃ¼bergehend nicht verfÃ¼gbar. Der restliche Bericht kann weiter erstellt werden.',
    },
    mk: {
      RATE_LIMIT: 'AI Ð°Ð½Ð°Ð»Ð¸Ð·Ð°Ñ‚Ð° Ð½Ð° Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸Ð¸ Ðµ Ð¼Ð¾Ð¼ÐµÐ½Ñ‚Ð°Ð»Ð½Ð¾ Ð·Ð°Ñ„Ð°Ñ‚ÐµÐ½Ð°. ÐžÐ±Ð¸Ð´ÐµÑ‚Ðµ ÑÐµ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾ Ð·Ð° ÐºÑ€Ð°Ñ‚ÐºÐ¾.',
      TIMEOUT: 'AI Ð°Ð½Ð°Ð»Ð¸Ð·Ð°Ñ‚Ð° Ñ‚Ñ€Ð°ÐµÑˆÐµ Ð¿Ñ€ÐµÐ´Ð¾Ð»Ð³Ð¾. ÐžÐ±Ð¸Ð´ÐµÑ‚Ðµ ÑÐµ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾ ÐºÐ¾Ð³Ð° Ð²Ñ€ÑÐºÐ°Ñ‚Ð° Ðµ ÑÑ‚Ð°Ð±Ð¸Ð»Ð½Ð°.',
      CONFIG_ERROR: 'AI Ð°Ð½Ð°Ð»Ð¸Ð·Ð°Ñ‚Ð° Ð½Ð° Ñ„Ð¾Ñ‚Ð¾Ð³Ñ€Ð°Ñ„Ð¸Ð¸ Ðµ Ð¿Ñ€Ð¸Ð²Ñ€ÐµÐ¼ÐµÐ½Ð¾ Ð½ÐµÐ´Ð¾ÑÑ‚Ð°Ð¿Ð½Ð°. ÐžÑÑ‚Ð°Ñ‚Ð¾ÐºÐ¾Ñ‚ Ð¾Ð´ Ð¸Ð·Ð²ÐµÑˆÑ‚Ð°Ñ˜Ð¾Ñ‚ Ð¼Ð¾Ð¶Ðµ Ð´Ð° Ð¿Ñ€Ð¾Ð´Ð¾Ð»Ð¶Ð¸.',
    },
    sq: {
      RATE_LIMIT: 'Analiza AI e fotografive Ã«shtÃ« pÃ«rkohÃ«sisht e ngarkuar. Provoni pÃ«rsÃ«ri pas pak.',
      TIMEOUT: 'Analiza AI e fotografisÃ« zgjati shumÃ«. Provoni pÃ«rsÃ«ri kur lidhja tÃ« jetÃ« e qÃ«ndrueshme.',
      CONFIG_ERROR: 'Analiza AI e fotografive Ã«shtÃ« pÃ«rkohÃ«sisht e padisponueshme. Raporti mund tÃ« vazhdojÃ«.',
    },
  }
  const localizedDetail = details[lang]?.[failure] ?? (lang === 'en' ? details.en[failure] : undefined) ?? fallback.detail
  return {
    signal: fallback.signal,
    detail: localizedDetail,
    recommendation: localizedDetail,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// â”€â”€â”€ OpenAI error body parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface OpenAIErrorDetail {
  status: number
  code: string    // e.g. 'insufficient_quota', 'rate_limit_exceeded', 'invalid_api_key'
  type: string    // e.g. 'insufficient_quota', 'requests', 'tokens'
  message: string // first 300 chars of the human-readable message
}

function parseOpenAIError(body: string, status: number): OpenAIErrorDetail {
  let code = ''
  let type = ''
  let message = ''
  try {
    const parsed = JSON.parse(body)
    code    = parsed?.error?.code    ?? ''
    type    = parsed?.error?.type    ?? ''
    message = (parsed?.error?.message ?? body).slice(0, 300)
  } catch {
    message = body.slice(0, 300)
  }
  return { status, code, type, message }
}

// Maps the parsed OpenAI error to our internal failure enum.
// More specific than failureFromStatus because it reads the error payload.
function failureFromOpenAIError(detail: OpenAIErrorDetail): AIProviderFailure {
  // Billing quota exhausted â€” no point retrying, user needs to top up the account.
  if (detail.code === 'insufficient_quota' || detail.type === 'insufficient_quota') return 'CONFIG_ERROR'
  // Invalid or revoked API key
  if (detail.code === 'invalid_api_key' || detail.status === 401 || detail.status === 403) return 'CONFIG_ERROR'
  // Genuine per-minute/per-day rate limit (retriable)
  if (detail.status === 429) return 'RATE_LIMIT'
  // OpenAI 5xx
  if (detail.status >= 500) return 'PROVIDER_OUTAGE'
  // Bad payload (our bug)
  if (detail.status === 400 || detail.status === 422) return 'BAD_REQUEST'
  return 'UNKNOWN'
}

function failureFromStatus(status: number): AIProviderFailure {
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'BAD_REQUEST'
  if (status === 401 || status === 403) return 'CONFIG_ERROR'
  if (status >= 500) return 'PROVIDER_OUTAGE'
  return 'UNKNOWN'
}

function failureFromError(error: unknown): AIProviderFailure {
  if (error instanceof DOMException && error.name === 'AbortError') return 'TIMEOUT'
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'RATE_LIMIT') return 'RATE_LIMIT'
  if (message === 'TIMEOUT') return 'TIMEOUT'
  if (message === 'OPENAI_QUOTA_EXCEEDED') return 'CONFIG_ERROR'
  if (message.startsWith('HTTP_')) {
    const status = Number(message.slice(5))
    return Number.isFinite(status) ? failureFromStatus(status) : 'UNKNOWN'
  }
  if (message.includes('parse') || message.includes('JSON') || message.includes('PROVIDER_RESPONSE_TRUNCATED')) return 'PROVIDER_RESPONSE'
  return 'UNKNOWN'
}

// Per-attempt timeout kept under the client's 35s window.
// Only retry on 429 rate-limit â€” timeout and 5xx are returned immediately
// so the client can decide whether to retry rather than burning the full window.
const OPENAI_ATTEMPT_TIMEOUT_MS = 28_000
const OPENAI_MAX_ATTEMPTS = 2

async function callOpenAIWithRetry(apiKey: string, payload: unknown, angle: string, requestId: string, startedAt: number): Promise<Response> {
  let lastStatus = 0
  for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_ATTEMPT_TIMEOUT_MS)
    try {
      pipelineLog({ step: 'analyze-photo:openai-call', requestId, success: true, durationMs: Date.now() - startedAt, meta: { angle, attempt, model: 'gpt-4o' } })
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      })
      lastStatus = response.status

      if (!response.ok) {
        // Read and parse the error body once â€” the response stream can only be read once.
        const rawBody = await response.text()
        const errDetail = parseOpenAIError(rawBody, response.status)
        const failureType = failureFromOpenAIError(errDetail)

        pipelineLog({ step: 'analyze-photo:openai-non-ok', requestId, success: false, durationMs: Date.now() - startedAt, meta: { angle, attempt, status: errDetail.status, openAICode: errDetail.code || '(none)', openAIType: errDetail.type || '(none)', openAIMessage: errDetail.message || '(none)', classifiedAs: failureType } })

        // Quota exhausted or invalid key â€” these are permanent; throw immediately,
        // no retry will help.
        if (failureType === 'CONFIG_ERROR') {
          throw new Error('OPENAI_QUOTA_EXCEEDED')
        }

        // For genuine rate-limit (429), retry once if we have attempts left.
        if (response.status === 429 && attempt < OPENAI_MAX_ATTEMPTS) {
          pipelineLog({ step: 'analyze-photo:openai-rate-limit-retry', requestId, success: false, durationMs: Date.now() - startedAt, meta: { angle, attempt } })
          clearTimeout(timeout)
          await sleep(1500)
          continue
        }

        // All other non-ok responses (5xx, 400, etc.) â€” throw immediately.
        throw new Error(`HTTP_${response.status}`)
      }

      return response
    } catch (error) {
      if (error instanceof Error && (error.message === 'OPENAI_QUOTA_EXCEEDED' || error.message.startsWith('HTTP_'))) {
        throw error // already classified â€” propagate without wrapping
      }
      // Timeout (AbortError) or network failure â€” propagate immediately (no retry)
      const isTimeout = error instanceof DOMException && error.name === 'AbortError'
      pipelineLog({ step: 'analyze-photo:openai-call-threw', requestId, success: false, durationMs: Date.now() - startedAt, meta: { angle, attempt, errorType: isTimeout ? 'AbortError/timeout' : 'network', message: error instanceof Error ? error.message : String(error) } })
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
  throw new Error(`HTTP_${lastStatus || 503}`)
}

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

  // Fast path: well-formed JSON object
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    // Verify it actually parses before returning (catches structurally-complete but internally broken JSON)
    try { JSON.parse(cleaned); return cleaned } catch { /* fall through to recovery */ }
  }

  // Slice from first '{' to last '}' â€” handles leading/trailing commentary
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    const candidate = cleaned.slice(start, end + 1)
    try { JSON.parse(candidate); return candidate } catch { /* fall through */ }
  }

  throw new Error('AI response did not contain a parseable JSON object')
}

function asImageQuality(value: unknown): ImageQuality {
  return value === 'good' || value === 'medium' || value === 'poor' || value === 'unusable'
    ? value
    : 'medium'
}

function asIssueSeverity(value: unknown): IssueSeverity {
  return value === 'minor' || value === 'moderate' || value === 'serious'
    ? value
    : 'minor'
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(0, 8)
    : []
}

function normalizeIssues(value: unknown): PhotoIssue[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .slice(0, 8)
    .map(item => ({
      area: typeof item.area === 'string' && item.area.trim() ? item.area.trim() : 'Visible area',
      issue: typeof item.issue === 'string' && item.issue.trim() ? item.issue.trim() : 'Visible condition concern',
      severity: asIssueSeverity(item.severity),
      confidence: clampScore(typeof item.confidence === 'number' ? item.confidence : 50, 0, 100, 50),
    }))
}

function capIssueSeverity(severity: IssueSeverity, max: IssueSeverity): IssueSeverity {
  const rank: Record<IssueSeverity, number> = { minor: 1, moderate: 2, serious: 3 }
  return rank[severity] > rank[max] ? max : severity
}

function calibrateAnalysis(analysis: StructuredPhotoAnalysis): StructuredPhotoAnalysis {
  const detectedIssues: PhotoIssue[] = []
  const possibleIssues: PhotoIssue[] = []

  analysis.detectedIssues.forEach((issue) => {
    if (issue.confidence < 55) {
      possibleIssues.push({ ...issue, severity: capIssueSeverity(issue.severity, 'minor') })
      return
    }
    if (issue.severity === 'serious' && issue.confidence < 78) {
      detectedIssues.push({ ...issue, severity: 'moderate' })
      return
    }
    detectedIssues.push(issue)
  })

  analysis.possibleIssues.forEach((issue) => {
    possibleIssues.push({ ...issue, severity: capIssueSeverity(issue.severity, 'moderate') })
  })

  return {
    ...analysis,
    detectedIssues: detectedIssues.slice(0, 6),
    possibleIssues: possibleIssues.slice(0, 6),
  }
}

function normalizeAnalysis(value: unknown): StructuredPhotoAnalysis {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return calibrateAnalysis({
    imageQuality: asImageQuality(raw.imageQuality),
    visibleAreas: asStringArray(raw.visibleAreas),
    detectedIssues: normalizeIssues(raw.detectedIssues),
    possibleIssues: normalizeIssues(raw.possibleIssues),
    uncertainAreas: asStringArray(raw.uncertainAreas),
    confidenceScore: clampScore(typeof raw.confidenceScore === 'number' ? raw.confidenceScore : 55, 0, 100, 55),
    recommendation: typeof raw.recommendation === 'string' && raw.recommendation.trim()
      ? raw.recommendation.trim()
      : 'Retake the photo closer and in better light if you need a more detailed inspection.',
    summary: typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim()
      : 'This photo provided limited visual detail for a complete analysis.',
  })
}

function legacySeverity(analysis: StructuredPhotoAnalysis): LegacySeverity {
  if (analysis.imageQuality === 'unusable') return 'warn'
  const hasHighConfidenceSerious = analysis.detectedIssues.some(issue => issue.severity === 'serious' && issue.confidence >= 78)
  if (hasHighConfidenceSerious && analysis.imageQuality !== 'poor') return 'flag'
  const hasActionableIssue = analysis.detectedIssues.some(issue => {
    if (issue.severity === 'minor') return issue.confidence >= 70
    return issue.confidence >= 55
  })
  const hasStrongPossibleIssue = analysis.possibleIssues.some(issue => issue.confidence >= 75 && issue.severity !== 'minor')
  if (hasActionableIssue || hasStrongPossibleIssue) return 'warn'
  return 'ok'
}

function legacySignal(analysis: StructuredPhotoAnalysis): string {
  const serious = analysis.detectedIssues.find(issue => issue.severity === 'serious')
  if (serious) return serious.issue.slice(0, 80)
  const detected = analysis.detectedIssues[0]
  if (detected) return detected.issue.slice(0, 80)
  const possible = analysis.possibleIssues[0]
  if (possible) return possible.issue.slice(0, 80)
  if (analysis.imageQuality === 'unusable') return 'Not inspectable'
  if (analysis.imageQuality === 'poor') return 'Limited visibility - broad inspection only'
  return 'No obvious issues detected in this view'
}

function legacyDetail(analysis: StructuredPhotoAnalysis): string {
  const parts = [analysis.summary]
  if (analysis.recommendation) {
    parts.push(analysis.recommendation)
  }
  return parts.join(' ')
}

// Condensed prompt used as one-shot recovery when the full response is truncated.
// Instructs the model to return the same schema but with shorter string values.
function buildCondensedPrompt(angleLabel: string, locale: string): string {
  return `You are a professional car inspector. Analyse the ${angleLabel} photo.
Be concise: max 8 words per issue description, max 1 sentence for summary, max 1 sentence for recommendation. Limit detectedIssues and possibleIssues to 2 items each.
Write in ${localeInstruction(locale)}.
Return valid JSON only.`
}

function buildPrompt(angle: string, angleLabel: string, locale: string): string {
  const areaFocus = ANGLE_AREA_GUIDE[angle] ?? 'Inspect all visible surfaces for damage, repaints, misalignments, or anomalies.'

  return `You are an expert pre-purchase car inspector analysing a real user's mobile photo of the vehicle's ${angleLabel} area.

${areaFocus}

The photo may have poor lighting, outdoor backgrounds, partial cropping, reflections, dirt, shadows, or a non-ideal distance. Be tolerant: if any vehicle area is visible, provide a useful inspection based on that visible evidence instead of saying analysis is unavailable.

Write all JSON string values in ${localeInstruction(locale)} using natural, professional automotive language.

Inspect strictly what is visible. Do not infer hidden damage, mileage, prior accidents, rust behind panels, or mechanical condition unless visual evidence is present.

Separate findings into:
- detectedIssues: high-confidence visual findings supported by clear evidence.
- possibleIssues: plausible concerns where the evidence is partial, affected by reflections, angle, distance, or lighting.
- uncertainAreas: important areas that are cropped, obscured, too dark, blurred, reflective, or not visible.

Calibration rules:
- Do not mark a concern as serious unless the visible evidence is clear, direct, and high confidence.
- Put reflection, shadow, dirt, distance, crop, or angle-limited concerns in possibleIssues, not detectedIssues.
- Minor cosmetic marks, small alignment doubts, and uncertain paint-tone differences should be minor or moderate, not serious.
- If evidence is weak, lower the confidence and explain what would need a better retake.

Image quality rules:
- good: enough detail for a meaningful inspection of the requested area.
- medium: usable but limited by distance, lighting, angle, reflection, or crop.
- poor: vehicle is visible but only broad comments are reliable.
- unusable: no relevant vehicle area is visible or the image is too corrupted, blurred, or dark to inspect.

If imageQuality is poor but usable, still fill visibleAreas and possibleIssues or detectedIssues when evidence exists. Use recommendation to request a better retake only when it would materially improve confidence.

Return only valid JSON with exactly these top-level keys:
{
  "imageQuality": "good"|"medium"|"poor"|"unusable",
  "visibleAreas": [strings],
  "detectedIssues": [{"area":string,"issue":string,"severity":"minor"|"moderate"|"serious","confidence":0-100}],
  "possibleIssues": [same shape as detectedIssues],
  "uncertainAreas": [strings],
  "confidenceScore": 0-100,
  "recommendation": string,
  "summary": string
}
No extra keys. No markdown fences. No prose outside the JSON.`

}

// Single-attempt OpenAI call â€” no retry logic. Used for the condensed recovery
// path so we don't compound retries on top of an already-failed attempt.
async function callOpenAIOnce(
  apiKey: string,
  payload: unknown,
  angle: string,
  requestId: string,
  startedAt: number,
  timeoutMs = OPENAI_ATTEMPT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
    })
  } finally {
    clearTimeout(timer)
    pipelineLog({ step: 'analyze-photo:openai-once-finished', requestId, success: true, durationMs: Date.now() - startedAt, meta: { angle } })
  }
}

// Parse a raw AI response text string into a normalized analysis.
// Returns null if the text cannot be extracted or parsed.
function parseAIText(text: string): StructuredPhotoAnalysis | null {
  try {
    const jsonStr = extractJsonObject(text)
    const raw = JSON.parse(jsonStr)
    return normalizeAnalysis(raw)
  } catch {
    return null
  }
}

// Build the success response payload from a normalized analysis.
function buildSuccessPayload(analysis: StructuredPhotoAnalysis) {
  return {
    signal:         legacySignal(analysis),
    severity:       legacySeverity(analysis),
    detail:         legacyDetail(analysis),
    confidence:     analysis.confidenceScore,
    imageQuality:   analysis.imageQuality,
    visibleAreas:   analysis.visibleAreas,
    detectedIssues: analysis.detectedIssues,
    possibleIssues: analysis.possibleIssues,
    uncertainAreas: analysis.uncertainAreas,
    confidenceScore: analysis.confidenceScore,
    recommendation: analysis.recommendation,
  }
}

// ─── T5 Pipeline step functions ──────────────────────────────────────────────
// Each returns PipelineResult so the route handler is a flat, readable sequence.
// Steps 3–6 run before any I/O to fail fast and cheaply.

type ValidatedRequest = z.infer<typeof schema>

/** Step 3 — Validate the request body against the Zod schema. */
function stepValidateRequest(body: unknown): PipelineResult<ValidatedRequest, 'VALIDATION_ERROR'> {
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return pipelineErr('validate-request', 'VALIDATION_ERROR', `${parsed.error.issues.length} validation issue(s)`)
  }
  return pipelineOk('validate-request', parsed.data)
}

/** Step 4 — Reject images that are too large (>750 KB after base64 decode). */
function stepCheckImageSize(
  requestBytes: number,
): PipelineResult<void, 'IMAGE_VALIDATION'> {
  if (requestBytes <= MAX_IMAGE_BYTES) return pipelineOk('check-image-size', undefined)
  return pipelineErr(
    'check-image-size',
    'IMAGE_VALIDATION',
    `Image is ${Math.round(requestBytes / 1024)} KB — exceeds the ${Math.round(MAX_IMAGE_BYTES / 1024)} KB limit. The app compresses photos automatically; this image may be an unusual format.`,
  )
}

/** Step 5 — Reject unknown inspection angles. */
function stepCheckAngle(angle: string): PipelineResult<void, 'IMAGE_VALIDATION'> {
  if (SUPPORTED_ANGLES.has(angle)) return pipelineOk('check-angle', undefined)
  return pipelineErr(
    'check-angle',
    'IMAGE_VALIDATION',
    `Angle “${angle}” is not a recognised inspection shot. Use one of the ${SUPPORTED_ANGLES.size} standard angles.`,
  )
}

/** Step 6 — Verify the OpenAI API key is configured. */
function stepGetApiKey(): PipelineResult<string, 'CONFIG_ERROR'> {
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) return pipelineOk('get-api-key', apiKey)
  return pipelineErr('get-api-key', 'CONFIG_ERROR', 'OPENAI_API_KEY is not set')
}

/**
 * Build the shared fallback response payload.
 * Consolidates the four previously identical inline objects into one helper
 * so any future shape changes only need to be made here.
 */
function buildFallbackData(
  fallback: { signal: string; detail: string; recommendation: string },
  failureReason: AIProviderFailure,
  detailOverride?: string,
) {
  return {
    signal:         fallback.signal,
    severity:       'warn' as const,
    detail:         detailOverride ?? fallback.detail,
    confidence:     0,
    imageQuality:   'unusable' as const,
    visibleAreas:   [],
    detectedIssues: [],
    possibleIssues: [],
    uncertainAreas: [],
    confidenceScore: 0,
    recommendation: fallback.recommendation,
    failureReason,
    isUsable:        false,
    usabilityReason: 'LOW_QUALITY' as const,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const reqStart  = Date.now()

  // Step 1: Auth
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  // Step 2: JSON parse
  let body: unknown
  try {
    body = await req.json()
  } catch {
    pipelineLog({ step: 'analyze-photo:invalid-json', requestId, success: false, durationMs: Date.now() - reqStart, meta: {} })
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }

  // Step 3: Validate request
  const validated = stepValidateRequest(body)
  if (!validated.success) {
    pipelineLog({ step: `analyze-photo:${validated.step}`, requestId, success: false, durationMs: Date.now() - reqStart, meta: { error: validated.error.code } })
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const { imageBase64, mimeType, angle, angleLabel, locale, imageMeta } = validated.data
  const requestBytes = Math.round((imageBase64.length * 3) / 4)

  // Step 4: Image size check
  const sizeCheck = stepCheckImageSize(requestBytes)
  if (!sizeCheck.success) {
    pipelineLog({ step: `analyze-photo:${sizeCheck.step}`, requestId, success: false, durationMs: Date.now() - reqStart, meta: { reason: 'OVERSIZED', requestBytes, limitBytes: MAX_IMAGE_BYTES, mimeType, angle } })
    return NextResponse.json({ data: buildFallbackData(fallbackForFailure(locale, 'IMAGE_VALIDATION'), 'IMAGE_VALIDATION', sizeCheck.error.message) })
  }

  // Step 5: Angle check
  const angleCheck = stepCheckAngle(angle)
  if (!angleCheck.success) {
    pipelineLog({ step: `analyze-photo:${angleCheck.step}`, requestId, success: false, durationMs: Date.now() - reqStart, meta: { reason: 'INVALID_ANGLE', angle, mimeType, requestBytes } })
    return NextResponse.json({ data: buildFallbackData(fallbackForFailure(locale, 'IMAGE_VALIDATION'), 'IMAGE_VALIDATION', angleCheck.error.message) })
  }

  // Step 6: API key
  const apiKeyResult = stepGetApiKey()
  if (!apiKeyResult.success) {
    pipelineLog({ step: `analyze-photo:${apiKeyResult.step}`, requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, failureType: 'CONFIG_ERROR' } })
    return NextResponse.json({ data: buildFallbackData(fallbackForFailure(locale, 'CONFIG_ERROR'), 'CONFIG_ERROR') })
  }
  const apiKey = apiKeyResult.data

  try {
    pipelineLog({ step: 'analyze-photo:request-received', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, mimeType, requestBytes, imageMeta, apiKeyPresent: true } })

    // â”€â”€ Shared image content block (reused in condensed retry) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const imageContent = {
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'auto' as const },
    }

    // callOpenAIWithRetry now throws on any non-ok response â€” no need to check response.ok here.
    // Use json_object mode (universally supported across all tiers) rather than json_schema strict
    // mode, which requires gpt-4o-2024-08-06+ and higher account tier and returns 400 otherwise.
    const response = await callOpenAIWithRetry(apiKey, {
      model: 'gpt-4o',
      max_tokens: 800,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a professional car inspector. Respond only with valid JSON matching the schema exactly.' },
        { role: 'user', content: [imageContent, { type: 'text', text: buildPrompt(angle, angleLabel, locale) }] },
      ],
    }, angle, requestId, reqStart)

    const result = await response.json()
    const finishReason: string = result.choices?.[0]?.finish_reason ?? 'unknown'
    const rawText: string = result.choices?.[0]?.message?.content ?? ''
    const usage = result.usage ?? {}
    pipelineLog({ step: 'analyze-photo:openai-response-received', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, finishReason, contentLength: rawText.length, promptTokens: usage.prompt_tokens ?? '?', completionTokens: usage.completion_tokens ?? '?', totalTokens: usage.total_tokens ?? '?' } })

    // â”€â”€ Truncation recovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // If the model hit the token limit, attempt one condensed retry before giving up.
    // This avoids silent degradation when 800 tokens is not enough for a verbose result.
    if (finishReason === 'length') {
      pipelineLog({ step: 'analyze-photo:truncation-recovery-start', requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, mimeType, contentLength: rawText.length, partialDetectedCount: (rawText.match(/"severity"/g) ?? []).length } })
      try {
        const condensedRes = await callOpenAIOnce(apiKey, {
          model: 'gpt-4o',
          max_tokens: 1200,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a professional car inspector. Respond only with valid JSON. Be concise.' },
            { role: 'user', content: [imageContent, { type: 'text', text: buildCondensedPrompt(angleLabel, locale) }] },
          ],
        }, angle, requestId, reqStart)

        if (condensedRes.ok) {
          const condensedResult = await condensedRes.json()
          const condensedFinish: string = condensedResult.choices?.[0]?.finish_reason ?? 'unknown'
          const condensedText: string = condensedResult.choices?.[0]?.message?.content ?? ''
          if (condensedFinish !== 'length' && condensedText) {
            const recovered = parseAIText(condensedText)
            if (recovered) {
              pipelineLog({ step: 'analyze-photo:condensed-recovery-succeeded', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, imageQuality: recovered.imageQuality } })
              const recoveredPayload  = buildSuccessPayload(recovered)
              const recoveredUsability = classifyImageUsability(recovered.imageQuality, recovered.confidenceScore, recoveredPayload.signal)
              if (!recoveredUsability.isUsable) {
                pipelineLog({ step: 'image:usability', requestId, success: true, durationMs: Date.now() - reqStart, meta: { usable: false, reason: recoveredUsability.usabilityReason, confidenceScore: recovered.confidenceScore, angle } })
              }
              pipelineLog({ step: 'analyze-photo:complete', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, path: 'condensed_recovery', imageQuality: recovered.imageQuality, detectedIssues: recovered.detectedIssues.length, possibleIssues: recovered.possibleIssues.length } })
              return NextResponse.json({ data: { ...recoveredPayload, isUsable: recoveredUsability.isUsable, usabilityReason: recoveredUsability.usabilityReason } })
            }
          }
        }
      } catch (condensedErr) {
        pipelineLog({ step: 'analyze-photo:condensed-recovery-failed', requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, reason: condensedErr instanceof Error ? condensedErr.message : String(condensedErr) } })
      }
      // Both attempts truncated or condensed call failed â€” surface as parse failure
      throw new Error('PROVIDER_RESPONSE_TRUNCATED')
    }

    // â”€â”€ Normal parse path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const analysis = parseAIText(rawText)
    if (!analysis) {
      pipelineLog({ step: 'analyze-photo:parse-failed', requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, contentLength: rawText.length } })
      throw new Error('Failed to parse AI response JSON')
    }

    pipelineLog({ step: 'analyze-photo:parsed-result', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, severity: legacySeverity(analysis), signal: legacySignal(analysis), imageQuality: analysis.imageQuality, confidenceScore: analysis.confidenceScore, detectedIssues: analysis.detectedIssues.length, possibleIssues: analysis.possibleIssues.length, uncertainAreas: analysis.uncertainAreas.length } })

    const successPayload  = buildSuccessPayload(analysis)
    const usability = classifyImageUsability(analysis.imageQuality, analysis.confidenceScore, successPayload.signal)
    if (!usability.isUsable) {
      pipelineLog({ step: 'image:usability', requestId, success: true, durationMs: Date.now() - reqStart, meta: { usable: false, reason: usability.usabilityReason, confidenceScore: analysis.confidenceScore, angle } })
    }
    pipelineLog({ step: 'analyze-photo:complete', requestId, success: true, durationMs: Date.now() - reqStart, meta: { angle, imageQuality: analysis.imageQuality, detectedIssues: analysis.detectedIssues.length, possibleIssues: analysis.possibleIssues.length, model: 'gpt-4o' } })
    return NextResponse.json({ data: { ...successPayload, isUsable: usability.isUsable, usabilityReason: usability.usabilityReason } })
  } catch (error) {
    const failureType = failureFromError(error)
    const reason = error instanceof Error ? error.message : String(error)
    logApiError('inspection/analyze-photo', 'analyze', error, { angle, failureType })
    pipelineLog({ step: 'analyze-photo:failed', requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, failureType, error: reason.slice(0, 200) } })
    pipelineLog({ step: 'analyze-photo:returning-fallback', requestId, success: false, durationMs: Date.now() - reqStart, meta: { angle, failureType, reason } })
    const fallback = fallbackForFailure(locale, failureType)
    return NextResponse.json(
      { data: buildFallbackData(fallback, failureType) },
      { status: 200 } // Return 200 so UI still renders — just shows the fallback
    )
  }
}

