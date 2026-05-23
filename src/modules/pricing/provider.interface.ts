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
  // Advanced filters — improve match precision when available
  fuelType?: string
  transmission?: string
  bodyType?: string
  mileage?: number
  /**
   * ISO 3166-1 alpha-2 country code.
   * Drives regional marketplace selection and pricing benchmarks.
   * Null/undefined → falls back to "RS" (Serbia) for backward compatibility.
   */
  countryCode?: string | null
}

export interface FiltersUsed {
  fuelType?: string
  transmission?: string
  bodyType?: string
}

export interface MarketPriceResult {
  minPrice: number
  maxPrice: number
  avgPrice: number
  /** ISO 4217 currency code — EUR for most markets, may differ for non-EU regions */
  currency: string
  /** How reliable this estimate is */
  confidence: 'low' | 'medium' | 'high'
  /** Human-readable source label shown in UI */
  source: string
  /** Optional context note for the UI */
  note?: string
  /** Number of real listings this price is based on (0 = model-based estimate) */
  listingCount?: number
  /** Which filters were actually applied when fetching listings */
  filtersUsed?: FiltersUsed
}

export interface VehiclePriceProviderInterface {
  readonly providerId: string
  readonly providerName: string
  /** Sync or async availability check */
  isAvailable(): boolean | Promise<boolean>
  getMarketPrice(query: PriceQuery): Promise<MarketPriceResult>
}
