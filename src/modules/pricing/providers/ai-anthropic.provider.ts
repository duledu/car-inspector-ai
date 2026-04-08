// =============================================================================
// AI Anthropic Price Provider — FALLBACK
// Uses Claude to estimate Serbia used-car market prices when the local-market
// model confidence is low or the vehicle is unusual/exotic.
// =============================================================================

import type { VehiclePriceProviderInterface, PriceQuery, MarketPriceResult } from '../provider.interface'

interface PriceOnlyResponse {
  minPrice: number
  maxPrice: number
  avgPrice: number
  confidence: 'low' | 'medium' | 'high'
  note: string
}

function buildPricePrompt(query: PriceQuery): string {
  const { make, model, year, engineCc, powerKw, trim } = query
  const age = new Date().getFullYear() - year
  const engineDesc = [
    engineCc ? `${(engineCc / 1000).toFixed(1)}L (${engineCc}cc)` : null,
    powerKw  ? `${powerKw}kW`                                       : null,
    trim,
  ].filter(Boolean).join(', ')

  return `You are a Serbian used-car market expert. Estimate the realistic market price range for a used ${year} ${make} ${model}${engineDesc ? ` (${engineDesc})` : ''} in Serbia.

Context:
- Vehicle age: ${age} years
- Market: Serbia (prices in EUR, typically 15-25% below western Europe)
- Source reference: Polovni Automobili, Oglasi.rs marketplace patterns

Rules:
- Prices must be realistic EUR values for the Serbian market, NOT EU/western prices
- Account for the specific engine/trim if given
- Return ONLY valid JSON, no markdown, no prose

{
  "minPrice": <integer EUR>,
  "maxPrice": <integer EUR>,
  "avgPrice": <integer EUR>,
  "confidence": "high" | "medium" | "low",
  "note": "<one sentence about this estimate>"
}`
}

export class AIAnthropicPriceProvider implements VehiclePriceProviderInterface {
  readonly providerId = 'ai-anthropic'
  readonly providerName = 'AI Price Estimate (Claude)'

  constructor(private readonly apiKey: string) {}

  isAvailable(): boolean {
    return Boolean(this.apiKey)
  }

  async getMarketPrice(query: PriceQuery): Promise<MarketPriceResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          messages: [{ role: 'user', content: buildPricePrompt(query) }],
        }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Anthropic price API ${response.status}: ${text.slice(0, 120)}`)
      }

      const json = await response.json()
      const raw: string = json.content?.[0]?.text ?? ''
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
      const parsed = JSON.parse(cleaned) as PriceOnlyResponse

      return {
        minPrice: Math.round(parsed.minPrice / 100) * 100,
        maxPrice: Math.round(parsed.maxPrice / 100) * 100,
        avgPrice: Math.round(parsed.avgPrice / 100) * 100,
        currency: 'EUR',
        confidence: parsed.confidence ?? 'low',
        source: 'AI estimate (Claude)',
        note: parsed.note,
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
