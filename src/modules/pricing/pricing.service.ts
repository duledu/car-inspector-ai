// =============================================================================
// Pricing Service — orchestrates VehiclePriceProviders
//
// Provider order (first success wins):
//   1. PalovniProvider   — real live listings from polovniautomobili.com
//   2. LocalMarketProvider — pure computation, always available (fallback)
//   3. AIAnthropicPriceProvider — enrichment when API key is present
//
// PalovniProvider tries strict → relaxed → broad filter matching internally.
// If it throws (bot-blocked, timeout, no listings), LocalMarket takes over.
// =============================================================================

import type { VehiclePriceProviderInterface, PriceQuery, MarketPriceResult } from './provider.interface'
import { LocalMarketProvider }      from './providers/local-market.provider'
import { AIAnthropicPriceProvider } from './providers/ai-anthropic.provider'
import { PalovniProvider }          from './providers/polovni.provider'

export type { PriceQuery, MarketPriceResult } from './provider.interface'

export class PricingService {
  private readonly providers: VehiclePriceProviderInterface[]

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
        console.log(
          `[pricing] ${provider.providerId} → ${result.minPrice}–${result.maxPrice} EUR` +
          ` (${result.confidence})` +
          (result.listingCount != null && result.listingCount > 0 ? ` — ${result.listingCount} listings` : '')
        )
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
    new PalovniProvider(),
    new LocalMarketProvider(),
    ...(anthropicKey ? [new AIAnthropicPriceProvider(anthropicKey)] : []),
  ]

  return new PricingService(providers)
}

export const pricingService = createPricingService()
