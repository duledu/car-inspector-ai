// =============================================================================
// Pricing Service — orchestrates VehiclePriceProviders
// Strategy: LOCAL MARKET (primary) → AI ANTHROPIC (fallback)
//
// The local-market provider is pure computation (always available).
// The AI provider runs only when local confidence is 'low' OR as a secondary
// enrichment when ANTHROPIC_API_KEY is present.
// =============================================================================

import type { VehiclePriceProviderInterface, PriceQuery, MarketPriceResult } from './provider.interface'
import { LocalMarketProvider }      from './providers/local-market.provider'
import { AIAnthropicPriceProvider } from './providers/ai-anthropic.provider'

export type { PriceQuery, MarketPriceResult }

export class PricingService {
  private providers: VehiclePriceProviderInterface[]

  constructor(providers: VehiclePriceProviderInterface[]) {
    this.providers = providers
  }

  async getMarketPrice(query: PriceQuery): Promise<MarketPriceResult> {
    let lastError: unknown

    for (const provider of this.providers) {
      const available = await Promise.resolve(provider.isAvailable())
      if (!available) continue

      try {
        const result = await provider.getMarketPrice(query)
        console.log(`[pricing] ${provider.providerId} → ${result.minPrice}–${result.maxPrice} EUR (${result.confidence})`)
        return result
      } catch (err) {
        console.warn(`[pricing] ${provider.providerId} failed:`, err instanceof Error ? err.message : err)
        lastError = err
      }
    }

    throw lastError ?? new Error('All pricing providers failed')
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export function createPricingService(): PricingService {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''

  const providers: VehiclePriceProviderInterface[] = [
    new LocalMarketProvider(),
    ...(anthropicKey ? [new AIAnthropicPriceProvider(anthropicKey)] : []),
  ]

  return new PricingService(providers)
}

export const pricingService = createPricingService()
