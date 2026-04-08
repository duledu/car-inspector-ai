// =============================================================================
// Vehicle Price Provider Interface
// All market-price providers must implement this contract.
// Modular: swap or add providers without changing consuming code.
// =============================================================================

export interface PriceQuery {
  make: string
  model: string
  year: number
  engineCc?: number
  powerKw?: number
  trim?: string
  askingPrice?: number
  currency?: string
}

export interface MarketPriceResult {
  minPrice: number
  maxPrice: number
  avgPrice: number
  /** Always EUR — internal normalisation */
  currency: 'EUR'
  /** How reliable this estimate is */
  confidence: 'low' | 'medium' | 'high'
  /** Human-readable source label shown in UI */
  source: string
  /** Optional context note for the UI */
  note?: string
}

export interface VehiclePriceProviderInterface {
  readonly providerId: string
  readonly providerName: string
  /** Sync or async availability check */
  isAvailable(): boolean | Promise<boolean>
  getMarketPrice(query: PriceQuery): Promise<MarketPriceResult>
}
