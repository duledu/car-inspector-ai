// =============================================================================
// Analyze Photo — POST /api/inspection/analyze-photo
// Sends a car photo to OpenAI Vision (gpt-4o) and returns structured findings.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { clampScore } from '@/modules/scoring/scoring.logic'

const schema = z.object({
  imageBase64: z.string().min(100),
  mimeType:    z.string().default('image/jpeg'),
  angle:       z.string().min(1),        // e.g. "FRONT", "LEFT_SIDE"
  angleLabel:  z.string().min(1),        // human label e.g. "Front"
  locale:      z.string().min(2).max(10).optional().default('en'),
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

  return `You are an expert pre-purchase car inspector analysing a photo of the vehicle's ${angleLabel} area.

${areaFocus}

Write the JSON string values in ${localeInstruction(locale)} using natural, professional automotive language.

Assess the image carefully and respond ONLY with valid JSON — no prose, no markdown fences:

{
  "signal": "One short headline finding (max 8 words)",
  "severity": "ok" | "warn" | "flag",
  "detail": "1-2 sentence explanation of what you see and why it matters for a buyer",
  "confidence": 0-100
}

Severity rules:
- "ok"   = no issues, consistent with factory condition
- "warn" = minor concern, worth noting but not deal-breaking
- "flag" = significant issue, should be investigated by a mechanic or used to negotiate price

Be honest. Do NOT default to "ok" unless the image is genuinely clean.
If the image is blurry, dark, or not showing the expected area, set severity "warn" and explain in detail.`
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
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const { imageBase64, mimeType, angle, angleLabel, locale } = parsed.data

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('[analyze-photo] OPENAI_API_KEY is not set')
    return apiError('AI analysis unavailable', { status: 503, code: 'CONFIG_ERROR' })
  }

  try {
    console.log('[analyze-photo] analysing:', angle)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        temperature: 0.2,
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
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: buildPrompt(angle, angleLabel, locale),
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze-photo] OpenAI error:', response.status, err)
      throw new Error(`OpenAI ${response.status}`)
    }

    const result = await response.json()
    const text: string = result.choices?.[0]?.message?.content ?? ''
    const jsonStr = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

    let parsed: { signal: string; severity: string; detail: string; confidence?: number }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      throw new Error('Failed to parse AI response')
    }

    // Normalise severity to expected values
    const sev = (['ok', 'warn', 'flag'] as const).includes(parsed.severity as 'ok' | 'warn' | 'flag')
      ? (parsed.severity as 'ok' | 'warn' | 'flag')
      : 'warn'

    console.log('[analyze-photo] result:', angle, sev, parsed.signal)

    return NextResponse.json({
      data: {
        signal:     parsed.signal ?? 'Analysis complete',
        severity:   sev,
        detail:     parsed.detail ?? '',
        confidence: clampScore(parsed.confidence, 0, 100, 80),
      },
    })
  } catch (error) {
    logApiError('inspection/analyze-photo', 'analyze', error, { angle })
    const fallback = fallbackAnalysis(locale)
    return NextResponse.json(
      {
        data: {
          signal:   fallback.signal,
          severity: 'warn',
          detail:   fallback.detail,
          confidence: 0,
        },
      },
      { status: 200 } // Return 200 so UI still renders — just shows the fallback
    )
  }
}
