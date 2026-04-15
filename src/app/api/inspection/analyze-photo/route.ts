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

const issueSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'issue', 'severity', 'confidence'],
  properties: {
    area: {
      type: 'string',
      description: 'Visible vehicle area where the issue appears, or "unknown" if unclear.',
    },
    issue: {
      type: 'string',
      description: 'Specific visual observation grounded in visible evidence.',
    },
    severity: {
      type: 'string',
      enum: ['minor', 'moderate', 'serious'],
    },
    confidence: {
      type: 'number',
      description: '0-100 confidence for this individual issue.',
    },
  },
} as const

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'imageQuality',
    'visibleAreas',
    'detectedIssues',
    'possibleIssues',
    'uncertainAreas',
    'confidenceScore',
    'recommendation',
    'summary',
  ],
  properties: {
    imageQuality: {
      type: 'string',
      enum: ['good', 'medium', 'poor', 'unusable'],
      description: 'good = detailed inspection possible, medium = usable with limitations, poor = usable only for broad comments, unusable = cannot inspect vehicle content.',
    },
    visibleAreas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Concrete visible vehicle parts, e.g. front bumper, left headlight, hood gap.',
    },
    detectedIssues: {
      type: 'array',
      items: issueSchema,
      description: 'High-confidence visible issues only.',
    },
    possibleIssues: {
      type: 'array',
      items: issueSchema,
      description: 'Suspected issues where the image suggests a concern but evidence is incomplete.',
    },
    uncertainAreas: {
      type: 'array',
      items: { type: 'string' },
      description: 'Areas that are obscured, too dark, too blurry, cropped out, or not visible enough.',
    },
    confidenceScore: {
      type: 'number',
      description: '0-100 overall confidence in the inspection result.',
    },
    recommendation: {
      type: 'string',
      description: 'Actionable next step for the user, including retake guidance when needed.',
    },
    summary: {
      type: 'string',
      description: 'Professional 1-2 sentence summary based only on visible evidence.',
    },
  },
} as const

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

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function failureFromStatus(status: number): AIProviderFailure {
  if (status === 429) return 'RATE_LIMIT'
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'BAD_REQUEST'
  if (status >= 500) return 'PROVIDER_OUTAGE'
  return 'UNKNOWN'
}

function failureFromError(error: unknown): AIProviderFailure {
  if (error instanceof DOMException && error.name === 'AbortError') return 'TIMEOUT'
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'RATE_LIMIT') return 'RATE_LIMIT'
  if (message === 'TIMEOUT') return 'TIMEOUT'
  if (message.startsWith('HTTP_')) {
    const status = Number(message.slice(5))
    return Number.isFinite(status) ? failureFromStatus(status) : 'UNKNOWN'
  }
  if (message.includes('parse') || message.includes('JSON')) return 'PROVIDER_RESPONSE'
  return 'UNKNOWN'
}

async function callOpenAIWithRetry(apiKey: string, payload: unknown, angle: string): Promise<Response> {
  let lastStatus = 0
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
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
      if (response.ok || !isRetriableStatus(response.status) || attempt === 3) {
        return response
      }
      console.warn('[analyze-photo] OpenAI retry scheduled', {
        angle,
        attempt,
        status: response.status,
        failureType: failureFromStatus(response.status),
      })
    } catch (error) {
      const failureType = failureFromError(error)
      if (attempt === 3 || failureType !== 'TIMEOUT') {
        throw error
      }
      console.warn('[analyze-photo] OpenAI retry scheduled', { angle, attempt, failureType })
    } finally {
      clearTimeout(timeout)
    }
    await sleep(1200 * attempt)
  }
  throw new Error(`HTTP_${lastStatus || 503}`)
}

function extractJsonObject(text: string): string {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) return cleaned

  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1)
  }

  throw new Error('AI response did not contain a JSON object')
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
  if (possible) return `Possible: ${possible.issue}`.slice(0, 80)
  if (analysis.imageQuality === 'unusable') return 'Image not inspectable'
  if (analysis.imageQuality === 'poor') return 'Limited photo quality'
  return 'No clear visual issue'
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

Return only valid JSON matching the required schema.`

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
    console.log('[analyze-photo] request received', {
      angle,
      mimeType,
      requestBytes,
      imageMeta,
    })

    const response = await callOpenAIWithRetry(apiKey, {
      model: 'gpt-4o',
      max_tokens: 300,
      temperature: 0.2,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'car_photo_inspection',
          strict: true,
          schema: responseSchema,
        },
      },
      messages: [
        {
          role: 'system',
          content: 'You are a professional car inspector. Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'auto',
              },
            },
            {
              type: 'text',
              text: buildPrompt(angle, angleLabel, locale),
            },
          ],
        },
      ],
    }, angle)

    if (!response.ok) {
      const err = await response.text()
      const failureType = failureFromStatus(response.status)
      console.error('[analyze-photo] OpenAI error', { angle, status: response.status, failureType, body: err.slice(0, 500) })
      throw new Error(`HTTP_${response.status}`)
    }

    const result = await response.json()
    const text: string = result.choices?.[0]?.message?.content ?? ''
    console.log('[analyze-photo] OpenAI response received', {
      angle,
      finishReason: result.choices?.[0]?.finish_reason,
      contentLength: text.length,
    })
    const jsonStr = extractJsonObject(text)

    let rawAnalysis: unknown
    try {
      rawAnalysis = JSON.parse(jsonStr)
    } catch (err) {
      console.error('[analyze-photo] parse failed', { angle, text })
      throw new Error(`Failed to parse AI response: ${err instanceof Error ? err.message : String(err)}`)
    }

    const analysis = normalizeAnalysis(rawAnalysis)
    const sev = legacySeverity(analysis)
    const signal = legacySignal(analysis)
    const detail = legacyDetail(analysis)

    console.log('[analyze-photo] parsed result', {
      angle,
      severity: sev,
      signal,
      imageQuality: analysis.imageQuality,
      confidenceScore: analysis.confidenceScore,
      detectedIssues: analysis.detectedIssues.length,
      possibleIssues: analysis.possibleIssues.length,
      uncertainAreas: analysis.uncertainAreas.length,
    })

    return NextResponse.json({
      data: {
        signal,
        severity: sev,
        detail,
        confidence: analysis.confidenceScore,
        imageQuality: analysis.imageQuality,
        visibleAreas: analysis.visibleAreas,
        detectedIssues: analysis.detectedIssues,
        possibleIssues: analysis.possibleIssues,
        uncertainAreas: analysis.uncertainAreas,
        confidenceScore: analysis.confidenceScore,
        recommendation: analysis.recommendation,
      },
    })
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
