// =============================================================================
// Vehicle Research Service
// AI provider: Anthropic Claude (primary) → knowledge base fallback
// Pricing: pricing.service runs in parallel, result merged into priceContext
// =============================================================================

import type { VehicleResearchResult, PriceContext } from '@/types'
import { generateFallbackResult }                   from './fallback.knowledge'
import { pricingService }                           from '@/modules/pricing/pricing.service'
import type { MarketPriceResult }                   from '@/modules/pricing/provider.interface'

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
  fuelType?: string
  transmission?: string
  bodyType?: string
  mileage?: number
}

export interface ResearchOutput extends VehicleResearchResult {
  limitedMode: boolean
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(params: ResearchParams): string {
  const { make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency, fuelType, transmission, bodyType } = params

  const litres     = engineCc ? (engineCc / 1000).toFixed(1) : null
  const ccLabel    = engineCc ? `${engineCc}cc`              : null
  const litreLabel = litres   ? `${litres}L`                 : null
  const kwLabel    = powerKw  ? `${powerKw}kW`               : null

  const engineSpec = [
    litreLabel && ccLabel ? `${litreLabel} (${ccLabel})` : (litreLabel ?? ccLabel),
    kwLabel,
  ].filter(Boolean).join(' ')

  const vehicleDesc = [year, make, model, trim, engine || engineSpec].filter(Boolean).join(' ')
  const curr        = currency ?? 'EUR'

  const variantNote = engineSpec
    ? `\nEngine variant: **${engineSpec}** — focus issues on THIS specific engine/gearbox combination.`
    : ''

  const filterParts = [
    fuelType     ? `Fuel: **${fuelType}**`           : null,
    transmission ? `Gearbox: **${transmission}**`    : null,
    bodyType     ? `Body style: **${bodyType}**`     : null,
  ].filter(Boolean)

  const filterNote = filterParts.length > 0
    ? `\nVehicle spec: ${filterParts.join(' | ')} — tailor known issues to this configuration.`
    : ''

  const priceNote = askingPrice
    ? `\nAsking price: **${askingPrice.toLocaleString()} ${curr}**`
    : ''

  const priceInstruction = askingPrice
    ? `The buyer is paying ${askingPrice.toLocaleString()} ${curr}. Evaluate against the Serbia used-car market range.`
    : `No asking price provided. Provide a realistic Serbia market price range in EUR.`

  return `You are an expert automotive advisor helping a buyer in Serbia inspect a used car.

Vehicle: **${vehicleDesc}**${variantNote}${filterNote}${priceNote}

${priceInstruction}

Generate a practical pre-inspection guide based on real known issues, owner reports, and expert knowledge for this exact vehicle.

Rules:
- Specific to this make/model/year AND engine variant where provided
- Use "commonly reported", "owners often note" language
- Focus on what a buyer physically checking this car should look for
- Include repair cost context for genuine financial risks
- Be concise and actionable

IMPORTANT — priceContext:
- Always populate priceContext — never omit it
- marketRangeFrom / marketRangeTo: realistic EUR integers for Serbia used-car market
- evaluation: "low" (below market / suspiciously cheap), "fair" (within range), "high" (above market)
- evaluationLabel: e.g. "Below market", "Fair market value", "Above market", "Estimate only"
- summary: 1-2 sentences comparing asking price (or absence) to Serbia market
- isEstimated: true
- avgPrice: integer EUR — midpoint of the realistic range
${askingPrice ? `- askingPrice: ${askingPrice}, currency: "${curr}"` : '- Omit askingPrice from priceContext'}

Respond ONLY with valid JSON. No markdown, no code fences.

{
  "vehicleKey": "${vehicleDesc}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high",
  "overallRiskLevel": "moderate",
  "summary": "1-2 sentence reliability overview for this specific variant",
  "priceContext": {
    ${askingPrice ? `"askingPrice": ${askingPrice}, "currency": "${curr}", ` : ''}"marketRangeFrom": 0, "marketRangeTo": 0, "avgPrice": 0,
    "evaluation": "fair", "evaluationLabel": "Fair market value",
    "summary": "...", "isEstimated": true, "source": "AI estimate", "confidence": "medium"
  },
  "sections": {
    "commonProblems":      { "id": "commonProblems",      "title": "Common Problems",        "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "highPriorityChecks":  { "id": "highPriorityChecks",  "title": "High-Priority Checks",   "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["HIGH_ATTENTION"] }] },
    "visualAttention":     { "id": "visualAttention",     "title": "Visual Attention Areas", "items": [{ "title": "...", "description": "...", "severity": "medium", "tags": ["VISUAL_CHECK"]   }] },
    "mechanicalWatchouts": { "id": "mechanicalWatchouts", "title": "Mechanical Watchouts",   "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "testDriveFocus":      { "id": "testDriveFocus",      "title": "Test Drive Focus",       "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["TEST_DRIVE"]     }] },
    "costAwareness":       { "id": "costAwareness",       "title": "Cost Awareness",         "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["EXPENSIVE_RISK"] }] }
  },
  "disclaimer": "AI-generated guide. Price range is an estimated market reference, not live data. Verify with a qualified mechanic before purchase."
}

Generate 3-5 items per section. Be specific to the ${vehicleDesc}.`
}

// ─── Price context builder — merges pricing-service result ────────────────────

function buildPriceContext(
  market: MarketPriceResult,
  askingPrice?: number,
  currency = 'EUR',
): PriceContext {
  const { minPrice, maxPrice, avgPrice, confidence, source, listingCount, filtersUsed } = market

  const rangeStr = `€${minPrice.toLocaleString('de-DE')} – €${maxPrice.toLocaleString('de-DE')}`

  let evaluation: PriceContext['evaluation']
  let evaluationLabel: string
  let summary: string

  if (askingPrice == null) {
    evaluation      = 'fair'
    evaluationLabel = 'Estimate only'
    summary = `Estimated Serbia market range for this vehicle: ${rangeStr} (avg €${avgPrice.toLocaleString('de-DE')}).`
  } else if (askingPrice < minPrice * 0.9) {
    evaluation      = 'low'
    evaluationLabel = 'Below market — investigate why'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} is below the typical Serbia range of ${rangeStr}. Unusually low prices warrant extra scrutiny.`
  } else if (askingPrice > maxPrice * 1.1) {
    evaluation      = 'high'
    evaluationLabel = 'Above market'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} is above the typical Serbia range of ${rangeStr}. Negotiate or verify premium features justify the premium.`
  } else {
    evaluation      = 'fair'
    evaluationLabel = 'Fair market value'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} sits within the typical Serbia range of ${rangeStr}.`
  }

  const filtersMatched = filtersUsed
    ? Object.fromEntries(Object.entries(filtersUsed).filter(([, v]) => v != null))
    : undefined

  return {
    ...(askingPrice != null ? { askingPrice, currency } : {}),
    marketRangeFrom: minPrice,
    marketRangeTo:   maxPrice,
    avgPrice,
    evaluation,
    evaluationLabel,
    summary,
    isEstimated: true,
    source,
    confidence,
    listingCount,
    filtersMatched:  Object.keys(filtersMatched ?? {}).length > 0 ? filtersMatched : undefined,
    filtersRelaxed:  listingCount != null && listingCount > 0 && filtersMatched != null
                       && Object.keys(filtersMatched).length < 3 ? true : undefined,
  }
}

// ─── Anthropic API caller ─────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  params: ResearchParams,
  timeoutMs: number,
): Promise<VehicleResearchResult> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(params) }],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Anthropic ${response.status}: ${text.slice(0, 200)}`)
    }

    const json    = await response.json()
    const raw: string = json.content?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    return JSON.parse(cleaned) as VehicleResearchResult
  } finally {
    clearTimeout(timer)
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VehicleResearchService {
  constructor(private readonly anthropicApiKey: string) {}

  async research(params: ResearchParams): Promise<ResearchOutput> {
    // ── Run research + pricing in parallel ──────────────────────────────────
    const [researchOutcome, pricingOutcome] = await Promise.allSettled([
      this.anthropicApiKey
        ? this.callWithRetry(params)
        : Promise.reject(new Error('No API key')),
      pricingService.getMarketPrice({
        make:         params.make,
        model:        params.model,
        year:         params.year,
        engineCc:     params.engineCc,
        powerKw:      params.powerKw,
        trim:         params.trim,
        askingPrice:  params.askingPrice,
        currency:     params.currency,
        fuelType:     params.fuelType,
        transmission: params.transmission,
        bodyType:     params.bodyType,
        mileage:      params.mileage,
      }),
    ])

    // ── Build final result ───────────────────────────────────────────────────
    let base: VehicleResearchResult
    let limitedMode = false

    if (researchOutcome.status === 'fulfilled') {
      base = researchOutcome.value
      console.log('[research] Anthropic OK')
    } else {
      console.warn('[research] AI failed — using knowledge base:', researchOutcome.reason)
      base        = generateFallbackResult(params)
      limitedMode = true
    }

    // Pricing service overrides / enriches priceContext
    if (pricingOutcome.status === 'fulfilled') {
      base.priceContext = buildPriceContext(
        pricingOutcome.value,
        params.askingPrice,
        params.currency,
      )
      console.log('[pricing] Context set from pricing service')
    } else if (!base.priceContext) {
      console.warn('[pricing] No price context available')
    }

    return { ...base, limitedMode }
  }

  private async callWithRetry(params: ResearchParams): Promise<VehicleResearchResult> {
    try {
      return await callAnthropic(this.anthropicApiKey, params, 12000)
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
      console.warn(`[research] Attempt 1 failed (${isTimeout ? 'timeout' : 'error'}) — retrying`)
    }
    // Second attempt with longer timeout
    return await callAnthropic(this.anthropicApiKey, params, 12000)
  }
}

// Singleton
export const vehicleResearchService = new VehicleResearchService(
  process.env.ANTHROPIC_API_KEY ?? '',
)
