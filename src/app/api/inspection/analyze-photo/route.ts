// =============================================================================
// Analyze Photo — POST /api/inspection/analyze-photo
// Sends a car photo to OpenAI Vision (gpt-4o) and returns structured findings.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { clampScore } from '@/modules/scoring/scoring.logic'

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

// ─── Prompt per angle ────────────────────────────────────────────────────────

function localeInstruction(locale: string): string {
  const language: Record<string, string> = {
    en: 'English',
    sr: 'Serbian',
    de: 'German',
    mk: 'Macedonian',
    sq: 'Albanian',
  }
  return language[locale.split('-')[0]] ?? 'English'
}

function fallbackAnalysis(locale: string): { signal: string; detail: string } {
  const lang = locale.split('-')[0]
  const messages: Record<string, { signal: string; detail: string }> = {
    en: {
      signal: 'Analysis unavailable',
      detail: 'Could not analyse this image. Please check your connection and try again.',
    },
    sr: {
      signal: 'Analiza nije dostupna',
      detail: 'Nije moguće analizirati ovu fotografiju. Proverite vezu i pokušajte ponovo.',
    },
    de: {
      signal: 'Analyse nicht verfügbar',
      detail: 'Dieses Bild konnte nicht analysiert werden. Prüfen Sie die Verbindung und versuchen Sie es erneut.',
    },
    mk: {
      signal: 'Анализата не е достапна',
      detail: 'Не можеше да се анализира оваа фотографија. Проверете ја врската и обидете се повторно.',
    },
    sq: {
      signal: 'Analiza nuk është e disponueshme',
      detail: 'Nuk mundëm ta analizonim këtë fotografi. Kontrolloni lidhjen dhe provoni përsëri.',
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
      RATE_LIMIT: 'AI analiza fotografija je trenutno zauzeta. Pokušajte ponovo za trenutak.',
      TIMEOUT: 'AI analiza fotografije je predugo trajala. Pokušajte ponovo kada je veza stabilna.',
      CONFIG_ERROR: 'AI analiza fotografija je trenutno nedostupna. Ostatak izveštaja i dalje možete završiti.',
    },
    de: {
      RATE_LIMIT: 'Die KI-Fotoanalyse ist momentan ausgelastet. Bitte versuchen Sie es gleich erneut.',
      TIMEOUT: 'Die KI-Fotoanalyse hat zu lange gedauert. Bitte versuchen Sie es bei stabiler Verbindung erneut.',
      CONFIG_ERROR: 'Die KI-Fotoanalyse ist vorübergehend nicht verfügbar. Der restliche Bericht kann weiter erstellt werden.',
    },
    mk: {
      RATE_LIMIT: 'AI анализата на фотографии е моментално зафатена. Обидете се повторно за кратко.',
      TIMEOUT: 'AI анализата траеше предолго. Обидете се повторно кога врската е стабилна.',
      CONFIG_ERROR: 'AI анализата на фотографии е привремено недостапна. Остатокот од извештајот може да продолжи.',
    },
    sq: {
      RATE_LIMIT: 'Analiza AI e fotografive është përkohësisht e ngarkuar. Provoni përsëri pas pak.',
      TIMEOUT: 'Analiza AI e fotografisë zgjati shumë. Provoni përsëri kur lidhja të jetë e qëndrueshme.',
      CONFIG_ERROR: 'Analiza AI e fotografive është përkohësisht e padisponueshme. Raporti mund të vazhdojë.',
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

// ─── OpenAI error body parsing ────────────────────────────────────────────────

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
  // Billing quota exhausted — no point retrying, user needs to top up the account.
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
// Only retry on 429 rate-limit — timeout and 5xx are returned immediately
// so the client can decide whether to retry rather than burning the full window.
const OPENAI_ATTEMPT_TIMEOUT_MS = 28_000
const OPENAI_MAX_ATTEMPTS = 2

async function callOpenAIWithRetry(apiKey: string, payload: unknown, angle: string): Promise<Response> {
  let lastStatus = 0
  for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_ATTEMPT_TIMEOUT_MS)
    try {
      console.log('[analyze-photo] calling OpenAI', { angle, attempt, model: 'gpt-4o' })
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
        // Read and parse the error body once — the response stream can only be read once.
        const rawBody = await response.text()
        const errDetail = parseOpenAIError(rawBody, response.status)
        const failureType = failureFromOpenAIError(errDetail)

        console.error('[analyze-photo] OpenAI non-ok response', {
          angle, attempt,
          status:         errDetail.status,
          openAICode:     errDetail.code    || '(none)',
          openAIType:     errDetail.type    || '(none)',
          openAIMessage:  errDetail.message || '(none)',
          classifiedAs:   failureType,
        })

        // Quota exhausted or invalid key — these are permanent; throw immediately,
        // no retry will help.
        if (failureType === 'CONFIG_ERROR') {
          throw new Error('OPENAI_QUOTA_EXCEEDED')
        }

        // For genuine rate-limit (429), retry once if we have attempts left.
        if (response.status === 429 && attempt < OPENAI_MAX_ATTEMPTS) {
          console.warn('[analyze-photo] rate-limit — retrying after backoff', { angle, attempt })
          clearTimeout(timeout)
          await sleep(1500)
          continue
        }

        // All other non-ok responses (5xx, 400, etc.) — throw immediately.
        throw new Error(`HTTP_${response.status}`)
      }

      return response
    } catch (error) {
      if (error instanceof Error && (error.message === 'OPENAI_QUOTA_EXCEEDED' || error.message.startsWith('HTTP_'))) {
        throw error // already classified — propagate without wrapping
      }
      // Timeout (AbortError) or network failure — propagate immediately (no retry)
      const isTimeout = error instanceof DOMException && error.name === 'AbortError'
      console.warn('[analyze-photo] OpenAI call threw', {
        angle, attempt,
        errorType: isTimeout ? 'AbortError/timeout' : 'network',
        message: error instanceof Error ? error.message : String(error),
      })
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

  // Slice from first '{' to last '}' — handles leading/trailing commentary
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

function normalizeAnalysis(value: unknown): StructuredPhotoAnalysis {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
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
      : 'The image was reviewed, but the model returned limited detail.',
  }
}

function legacySeverity(analysis: StructuredPhotoAnalysis): LegacySeverity {
  if (analysis.imageQuality === 'unusable') return 'warn'
  if (analysis.detectedIssues.some(issue => issue.severity === 'serious')) return 'flag'
  if (analysis.detectedIssues.length > 0 || analysis.possibleIssues.length > 0 || analysis.imageQuality === 'poor') return 'warn'
  return 'ok'
}

function legacySignal(analysis: StructuredPhotoAnalysis): string {
  const serious = analysis.detectedIssues.find(issue => issue.severity === 'serious')
  if (serious) return serious.issue.slice(0, 80)
  const detected = analysis.detectedIssues[0]
  if (detected) return detected.issue.slice(0, 80)
  const possible = analysis.possibleIssues[0]
  if (possible) return possible.issue.slice(0, 80)
  if (analysis.imageQuality === 'unusable') return 'Image not inspectable'
  if (analysis.imageQuality === 'poor') return 'Limited visibility — broad inspection only'
  return 'No issues detected'
}

function legacyDetail(analysis: StructuredPhotoAnalysis): string {
  const parts = [analysis.summary]
  if (analysis.uncertainAreas.length > 0) {
    parts.push(`Uncertain: ${analysis.uncertainAreas.slice(0, 3).join(', ')}.`)
  }
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
  const areaGuide: Record<string, string> = {
    FRONT:       'Focus on: bumper alignment, grille gaps, headlight symmetry, hood gap consistency, any paint colour mismatch.',
    REAR:        'Focus on: rear bumper alignment, tail-light symmetry, trunk gap, colour tone vs quarter panels.',
    LEFT_SIDE:   'Focus on: door panel gaps, crease line continuity, paint tone across panels, any ripple or filler signs.',
    RIGHT_SIDE:  'Focus on: door panel gaps, crease line continuity, paint tone across panels, any ripple or filler signs.',
    FRONT_LEFT:  'Focus on: front-left corner impact markers, headlight fit, fender-bumper gap.',
    FRONT_RIGHT: 'Focus on: front-right corner impact markers, headlight fit, fender-bumper gap.',
    HOOD:        'Focus on: surface texture uniformity, paint tone vs fenders, any ripple, filler, or overspray near edges.',
    ROOF:        'Focus on: panel flatness, paint consistency, any dents or hail damage.',
    TRUNK:       'Focus on: boot/trunk lid gap symmetry, hinge alignment, paint match vs rear.',
    ENGINE_BAY:  'Focus on: fluid residue or stains (oil, coolant), corroded hoses or wiring, accident repair evidence, cleanliness vs mileage.',
    INTERIOR:    'Focus on: seat wear vs claimed mileage, dashboard cracks or sun damage, water ingress stains on carpet or headliner.',
    ODOMETER:    'Focus on: reading clearly, note the mileage value, flag if display looks tampered or reset.',
    VIN_PLATE:   'Focus on: plate condition, signs of tampering or re-stamping.',
    WHEELS_FL:   'Focus on: brake pad thickness visible through spokes, rotor condition, kerb damage on alloy.',
    WHEELS_FR:   'Focus on: brake pad thickness visible through spokes, rotor condition, kerb damage on alloy.',
    UNDERBODY:   'Focus on: rust patches, previous weld repairs, structural member condition, exhaust condition.',
  }

  const areaFocus = areaGuide[angle] ?? 'Inspect all visible surfaces for damage, repaints, misalignments, or anomalies.'

  return `You are an expert pre-purchase car inspector analysing a real user's mobile photo of the vehicle's ${angleLabel} area.

${areaFocus}

The photo may have poor lighting, outdoor backgrounds, partial cropping, reflections, dirt, shadows, or a non-ideal distance. Be tolerant: if any vehicle area is visible, provide a useful inspection based on that visible evidence instead of saying analysis is unavailable.

Write all JSON string values in ${localeInstruction(locale)} using natural, professional automotive language.

Inspect strictly what is visible. Do not infer hidden damage, mileage, prior accidents, rust behind panels, or mechanical condition unless visual evidence is present.

Separate findings into:
- detectedIssues: high-confidence visual findings supported by clear evidence.
- possibleIssues: plausible concerns where the evidence is partial, affected by reflections, angle, distance, or lighting.
- uncertainAreas: important areas that are cropped, obscured, too dark, blurred, reflective, or not visible.

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

// Single-attempt OpenAI call — no retry logic. Used for the condensed recovery
// path so we don't compound retries on top of an already-failed attempt.
async function callOpenAIOnce(
  apiKey: string,
  payload: unknown,
  angle: string,
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
    console.log('[analyze-photo] callOpenAIOnce finished', { angle })
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

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.warn('[analyze-photo] validation failed', parsed.error.flatten())
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const { imageBase64, mimeType, angle, angleLabel, locale, imageMeta } = parsed.data

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[analyze-photo] OPENAI_API_KEY is not set')
    const fallback = fallbackForFailure(locale, 'CONFIG_ERROR')
    return NextResponse.json({
      data: {
        signal: fallback.signal,
        severity: 'warn',
        detail: fallback.detail,
        confidence: 0,
        imageQuality: 'unusable',
        visibleAreas: [],
        detectedIssues: [],
        possibleIssues: [],
        uncertainAreas: ['AI service is not configured'],
        confidenceScore: 0,
        recommendation: fallback.recommendation,
        failureReason: 'CONFIG_ERROR',
      },
    })
  }

  try {
    const requestBytes = Math.round((imageBase64.length * 3) / 4)
    // Log key presence without exposing the key value.
    console.log('[analyze-photo] request received', {
      angle, mimeType, requestBytes,
      imageMeta,
      apiKeyPresent: !!apiKey,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.startsWith('sk-') ? apiKey.slice(0, 7) : '(unexpected prefix)',
    })

    // ── Shared image content block (reused in condensed retry) ────────────────
    const imageContent = {
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'auto' as const },
    }

    // callOpenAIWithRetry now throws on any non-ok response — no need to check response.ok here.
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
    }, angle)

    const result = await response.json()
    const finishReason: string = result.choices?.[0]?.finish_reason ?? 'unknown'
    const rawText: string = result.choices?.[0]?.message?.content ?? ''
    const usage = result.usage ?? {}
    console.log('[analyze-photo] OpenAI response received', {
      angle, finishReason,
      contentLength: rawText.length,
      promptTokens:     usage.prompt_tokens     ?? '?',
      completionTokens: usage.completion_tokens ?? '?',
      totalTokens:      usage.total_tokens      ?? '?',
    })

    // ── Truncation recovery ──────────────────────────────────────────────────
    // If the model hit the token limit, attempt one condensed retry before giving up.
    // This avoids silent degradation when 800 tokens is not enough for a verbose result.
    if (finishReason === 'length') {
      console.warn('[analyze-photo] truncation detected — attempting condensed recovery', {
        angle,
        mimeType,
        contentLength: rawText.length,
        // Attempt to count issues in the truncated text for diagnostics
        partialDetectedCount: (rawText.match(/"severity"/g) ?? []).length,
      })
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
        }, angle)

        if (condensedRes.ok) {
          const condensedResult = await condensedRes.json()
          const condensedFinish: string = condensedResult.choices?.[0]?.finish_reason ?? 'unknown'
          const condensedText: string = condensedResult.choices?.[0]?.message?.content ?? ''
          if (condensedFinish !== 'length' && condensedText) {
            const recovered = parseAIText(condensedText)
            if (recovered) {
              console.log('[analyze-photo] condensed recovery succeeded', { angle, imageQuality: recovered.imageQuality })
              return NextResponse.json({ data: buildSuccessPayload(recovered) })
            }
          }
        }
      } catch (condensedErr) {
        console.warn('[analyze-photo] condensed recovery failed', {
          angle,
          reason: condensedErr instanceof Error ? condensedErr.message : String(condensedErr),
        })
      }
      // Both attempts truncated or condensed call failed — surface as parse failure
      throw new Error('PROVIDER_RESPONSE_TRUNCATED')
    }

    // ── Normal parse path ────────────────────────────────────────────────────
    const analysis = parseAIText(rawText)
    if (!analysis) {
      console.error('[analyze-photo] parse failed', { angle, rawText: rawText.slice(0, 200) })
      throw new Error('Failed to parse AI response JSON')
    }

    console.log('[analyze-photo] parsed result', {
      angle,
      severity: legacySeverity(analysis),
      signal: legacySignal(analysis),
      imageQuality: analysis.imageQuality,
      confidenceScore: analysis.confidenceScore,
      detectedIssues: analysis.detectedIssues.length,
      possibleIssues: analysis.possibleIssues.length,
      uncertainAreas: analysis.uncertainAreas.length,
    })

    return NextResponse.json({ data: buildSuccessPayload(analysis) })
  } catch (error) {
    const failureType = failureFromError(error)
    const reason = error instanceof Error ? error.message : String(error)
    logApiError('inspection/analyze-photo', 'analyze', error, { angle, failureType })
    console.warn('[analyze-photo] returning fallback', { angle, failureType, reason })
    const fallback = fallbackForFailure(locale, failureType)
    return NextResponse.json(
      {
        data: {
          signal: fallback.signal,
          severity: 'warn',
          detail: fallback.detail,
          confidence: 0,
          imageQuality: 'unusable',
          visibleAreas: [],
          detectedIssues: [],
          possibleIssues: [],
          uncertainAreas: ['AI analysis did not complete'],
          confidenceScore: 0,
          recommendation: fallback.recommendation,
          failureReason: failureType,
        },
      },
      { status: 200 } // Return 200 so UI still renders — just shows the fallback
    )
  }
}
