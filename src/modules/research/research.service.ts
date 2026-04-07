// =============================================================================
// Vehicle Research Service
// Orchestrates: AI provider (OpenAI) → brand knowledge base → generic fallback
// =============================================================================

import type { VehicleResearchResult } from '@/types'
import { generateFallbackResult } from './fallback.knowledge'

export interface ResearchParams {
  make: string
  model: string
  year: number
  engineCc?: number
  powerKw?: number
  engine?: string
  trim?: string
  askingPrice?: number
  currency?: string
}

export interface ResearchOutput extends VehicleResearchResult {
  limitedMode: boolean
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(params: ResearchParams): string {
  const { make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency } = params

  const litres     = engineCc ? (engineCc / 1000).toFixed(1) : null
  const ccLabel    = engineCc ? `${engineCc}cc` : null
  const litreLabel = litres   ? `${litres}L`    : null
  const kwLabel    = powerKw  ? `${powerKw}kW`  : null

  const engineSpec = [litreLabel && ccLabel ? `${litreLabel} (${ccLabel})` : (litreLabel ?? ccLabel), kwLabel]
    .filter(Boolean).join(' ')

  const vehicleDesc = [year, make, model, trim, engine || engineSpec].filter(Boolean).join(' ')

  const variantNote = engineSpec
    ? `\nEngine variant: **${engineSpec}** — focus issues on THIS specific engine/gearbox combination, not the entire model range.`
    : ''

  const curr = currency ?? 'EUR'
  const priceNote = askingPrice
    ? `\nAsking price: **${askingPrice.toLocaleString()} ${curr}**`
    : ''

  const priceContextInstruction = askingPrice
    ? `The buyer is asking ${askingPrice.toLocaleString()} ${curr} for this car.
Compare this to the Serbia used-car market. Provide a realistic market range in EUR.`
    : `No asking price provided. Still provide a realistic Serbia market price range for this vehicle in EUR based on typical listings.`

  return `You are an expert automotive advisor helping a buyer in Serbia inspect a used car.

The buyer is about to inspect a **${vehicleDesc}**.${variantNote}${priceNote}

${priceContextInstruction}

Generate a practical pre-inspection guide based on real known issues, owner reports, and expert knowledge for this exact vehicle and engine variant.

Rules:
- Be specific to this make/model/year AND engine displacement/power where provided
- Different engine variants have different failure modes — prioritise variant-specific problems
- Use "commonly reported", "owners often note" language — not absolute facts
- Focus on what a buyer physically checking this car should look for
- Include repair cost context where it is a genuine financial risk
- Be concise and actionable

IMPORTANT — priceContext field:
- Always populate "priceContext" — never omit it
- "marketRangeFrom" and "marketRangeTo" must be integers in EUR representing the Serbia used-car market for this exact variant and year
- "evaluation": "low" if asking price is below range or suspiciously cheap, "fair" if within range, "high" if above range. If no asking price, set "evaluation": "fair" and note it in evaluationLabel
- "evaluationLabel": short human label, e.g. "Below market", "Fair market value", "Above market", "No asking price — estimate only"
- "summary": 1-2 sentences — how the asking price (or lack of one) compares to the Serbia market and what this means for the buyer
- "isEstimated": true always (we are using AI estimation, not live data)
${askingPrice ? `- Include "askingPrice": ${askingPrice}, "currency": "${curr}"` : '- Omit "askingPrice" from priceContext'}

Respond ONLY with valid JSON. No markdown, no code fences, no prose before or after.

{
  "vehicleKey": "${vehicleDesc}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high",
  "overallRiskLevel": "moderate",
  "summary": "1-2 sentence overview of reliability for this specific variant and what buyers should know",
  "priceContext": {
    ${askingPrice ? `"askingPrice": ${askingPrice}, "currency": "${curr}", ` : ''}"marketRangeFrom": 0,
    "marketRangeTo": 0,
    "evaluation": "fair",
    "evaluationLabel": "Fair market value",
    "summary": "...",
    "isEstimated": true
  },
  "sections": {
    "commonProblems":     { "id": "commonProblems",     "title": "Common Problems",          "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "highPriorityChecks": { "id": "highPriorityChecks", "title": "High-Priority Checks",     "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["HIGH_ATTENTION"] }] },
    "visualAttention":    { "id": "visualAttention",    "title": "Visual Attention Areas",   "items": [{ "title": "...", "description": "...", "severity": "medium", "tags": ["VISUAL_CHECK"]   }] },
    "mechanicalWatchouts":{ "id": "mechanicalWatchouts","title": "Mechanical Watchouts",     "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "testDriveFocus":     { "id": "testDriveFocus",     "title": "Test Drive Focus",         "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["TEST_DRIVE"]     }] },
    "costAwareness":      { "id": "costAwareness",      "title": "Cost Awareness",           "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["EXPENSIVE_RISK"] }] }
  },
  "disclaimer": "AI-generated guide. Price range is an estimated market reference, not live data. Verify with a qualified mechanic before purchase."
}

Generate 3-5 items per section. Be specific to the ${vehicleDesc}.`
}

// ─── OpenAI caller with timeout ───────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  params: ResearchParams,
  timeoutMs: number
): Promise<VehicleResearchResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 3500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert automotive advisor specialising in the Serbian used-car market. Respond with valid JSON only — the structure specified by the user.',
          },
          { role: 'user', content: buildPrompt(params) },
        ],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`)
    }

    const json = await response.json()
    const content: string = json.choices?.[0]?.message?.content ?? ''

    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned) as VehicleResearchResult
  } finally {
    clearTimeout(timer)
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VehicleResearchService {
  constructor(private readonly openaiApiKey: string) {}

  async research(params: ResearchParams): Promise<ResearchOutput> {
    if (!this.openaiApiKey) {
      console.log('[research] No API key — using knowledge base')
      return { ...generateFallbackResult(params), limitedMode: true }
    }

    // Attempt 1
    try {
      const result = await callOpenAI(this.openaiApiKey, params, 8000)
      console.log('[research] AI response OK (attempt 1)')
      return { ...result, limitedMode: false }
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
      console.warn(`[research] Attempt 1 failed (${isTimeout ? 'timeout' : 'error'}) — retrying`)
    }

    // Attempt 2
    try {
      const result = await callOpenAI(this.openaiApiKey, params, 8000)
      console.log('[research] AI response OK (attempt 2)')
      return { ...result, limitedMode: false }
    } catch (err) {
      console.warn('[research] Attempt 2 failed — using knowledge base fallback:', err instanceof Error ? err.message : err)
    }

    // Fallback — knowledge base
    console.log('[research] Using knowledge base fallback')
    return { ...generateFallbackResult(params), limitedMode: true }
  }
}

// Singleton — API key is read once at module load (server-side only)
export const vehicleResearchService = new VehicleResearchService(
  process.env.OPENAI_API_KEY ?? ''
)
