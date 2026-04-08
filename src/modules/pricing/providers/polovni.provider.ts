// =============================================================================
// Polovni Automobili Provider — real Serbian used-car listings
// Fetches live search results from polovniautomobili.com and derives a
// realistic market price range from actual listings.
//
// Fallback strategy (strict → relaxed → broad):
//   1. diesel + automatic + wagon  →  if <5 listings
//   2. diesel + automatic          →  if still <5
//   3. make + model + year only    →  always enough
//
// Normalization maps Serbian text values to our internal enum strings.
// Confidence is reduced when listing count is low (<5) or filters were relaxed.
// =============================================================================

import type { VehiclePriceProviderInterface, PriceQuery, MarketPriceResult, FiltersUsed } from '../provider.interface'

// ─── Polovni Automobili filter codes ─────────────────────────────────────────

const FUEL_CODES: Record<string, string> = {
  petrol:   '1',
  diesel:   '2',
  hybrid:   '3',
  electric: '4',
  lpg:      '8',
}

const GEARBOX_CODES: Record<string, string> = {
  manual:    '1',
  automatic: '2',
}

// Body style codes used in Polovni Automobili search
const BODY_CODES: Record<string, string> = {
  sedan:    '2039',
  wagon:    '2040',
  hatchback:'2041',
  coupe:    '2042',
  suv:      '2630',
  van:      '2044',
}

// ─── Value normalisation — Serbian → internal ─────────────────────────────────

const FUEL_NORMALISE: Record<string, string> = {
  'dizel':      'diesel',
  'benzin':     'petrol',
  'benzin+plin':'lpg',
  'tng':        'lpg',
  'gas':        'lpg',
  'hibrid':     'hybrid',
  'elektro':    'electric',
  'električni': 'electric',
}

const GEARBOX_NORMALISE: Record<string, string> = {
  'automatik':  'automatic',
  'automatski': 'automatic',
  'manuelni':   'manual',
  'manuelno':   'manual',
  'manualni':   'manual',
}

const BODY_NORMALISE: Record<string, string> = {
  'karavan':    'wagon',
  'limuzina':   'sedan',
  'hatchback':  'hatchback',
  'kupe':       'coupe',
  'kabriolet':  'coupe',
  'suv':        'suv',
  'off-road':   'suv',
  'minivan':    'van',
  'monovolumen':'van',
}

function normaliseText(map: Record<string, string>, raw: string): string {
  return map[raw.toLowerCase().trim()] ?? raw
}

// ─── Price parser — Serbian number format (. = thousands separator) ───────────
// Matches: "12.500 €", "8.900€", "12500 €", "15.500 EUR"

const PRICE_RE = /(\d{1,3}(?:\.\d{3})+|\d{4,6})\s*(?:€|EUR)/gi

function extractPrices(html: string): number[] {
  const prices: number[] = []
  let match: RegExpExecArray | null

  // Reset lastIndex for global regex reuse
  PRICE_RE.lastIndex = 0

  while ((match = PRICE_RE.exec(html)) !== null) {
    // Remove thousands dots (Serbian format) then parse
    const raw = match[1].replace(/\./g, '')
    const value = Number.parseInt(raw, 10)
    // Sanity-check: only real used-car prices (500 – 200 000 EUR)
    if (value >= 500 && value <= 200_000) {
      prices.push(value)
    }
  }

  return prices
}

// ─── Stats from a list of prices (outlier-resistant) ─────────────────────────

interface PriceStats {
  min: number
  max: number
  avg: number
  count: number
}

function computeStats(prices: number[]): PriceStats | null {
  if (prices.length === 0) return null

  const sorted = [...prices].sort((a, b) => a - b)

  // Trim outer 10% to remove outlier listings
  const trimCount = Math.floor(sorted.length * 0.1)
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount || sorted.length)

  if (trimmed.length === 0) return null

  const avg = Math.round(trimmed.reduce((s, p) => s + p, 0) / trimmed.length)
  return {
    min:   Math.round(trimmed[0] / 100) * 100,
    max:   Math.round(trimmed[trimmed.length - 1] / 100) * 100,
    avg:   Math.round(avg / 100) * 100,
    count: trimmed.length,
  }
}

// ─── URL builder ──────────────────────────────────────────────────────────────

function buildSearchUrl(
  make: string,
  model: string,
  year: number,
  filters: { fuelType?: string; transmission?: string; bodyType?: string },
): string {
  const base = 'https://www.polovniautomobili.com/auto-oglasi/pretraga'
  const params = new URLSearchParams()

  // Brand/model — PA uses lowercase, spaces → hyphens for multi-word models
  params.append('brand[0]', make.toLowerCase().replace(/\s+/g, '-'))
  params.append('model[0]', model.toLowerCase().replace(/\s+/g, '-'))

  // Year range: ±1 year to get enough results
  params.append('year_from', String(year - 1))
  params.append('year_to',   String(year + 1))

  if (filters.fuelType && FUEL_CODES[filters.fuelType]) {
    params.append('fuel_type[0]', FUEL_CODES[filters.fuelType])
  }
  if (filters.transmission && GEARBOX_CODES[filters.transmission]) {
    params.append('gearbox[0]', GEARBOX_CODES[filters.transmission])
  }
  if (filters.bodyType && BODY_CODES[filters.bodyType]) {
    params.append('body_style[0]', BODY_CODES[filters.bodyType])
  }

  // Sort by date so newest listings appear first
  params.append('sort', 'renewDate_desc')

  return `${base}?${params.toString()}`
}

// ─── Single fetch attempt ─────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8_000

async function fetchListingPrices(url: string): Promise<number[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'sr-RS,sr;q=0.9,en;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    })

    if (!res.ok) return []

    const html = await res.text()

    // Try __NEXT_DATA__ first — structured price data if PA is Next.js-powered
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1])
        const ads: unknown[] = json?.props?.pageProps?.ads
          ?? json?.props?.pageProps?.initialData?.ads
          ?? []
        if (Array.isArray(ads) && ads.length > 0) {
          return ads
            .map((ad: unknown) => {
              const a = ad as Record<string, unknown>
              return typeof a.price === 'number' ? a.price : Number.parseInt(String(a.price ?? '0'), 10)
            })
            .filter((p) => p >= 500 && p <= 200_000)
        }
      } catch {
        // __NEXT_DATA__ didn't parse cleanly — fall through to regex
      }
    }

    // Regex fallback — extract prices from rendered HTML
    return extractPrices(html)
  } finally {
    clearTimeout(timer)
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class PalovniProvider implements VehiclePriceProviderInterface {
  readonly providerId = 'polovni-automobili'
  readonly providerName = 'Polovni Automobili (live listings)'

  isAvailable(): boolean {
    // Always try — will throw on fetch failure, pricing service falls back
    return true
  }

  async getMarketPrice(query: PriceQuery): Promise<MarketPriceResult> {
    const { make, model, year, fuelType, transmission, bodyType } = query

    // ── Attempt 1: strict — all three filters ─────────────────────────────────
    const strictFilters = { fuelType, transmission, bodyType }
    let prices = await fetchListingPrices(buildSearchUrl(make, model, year, strictFilters))
    let stats  = computeStats(prices)
    let filtersApplied: FiltersUsed = strictFilters
    let relaxed = false

    // ── Attempt 2: relax body type ────────────────────────────────────────────
    if (!stats || stats.count < 5) {
      const relaxedFilters = { fuelType, transmission }
      prices = await fetchListingPrices(buildSearchUrl(make, model, year, relaxedFilters))
      stats  = computeStats(prices)
      filtersApplied = relaxedFilters
      relaxed = true
    }

    // ── Attempt 3: only fuel type ─────────────────────────────────────────────
    if (!stats || stats.count < 5) {
      const fuelOnlyFilters = { fuelType }
      prices = await fetchListingPrices(buildSearchUrl(make, model, year, fuelOnlyFilters))
      stats  = computeStats(prices)
      filtersApplied = fuelOnlyFilters
    }

    // ── Attempt 4: broad — no filters at all ─────────────────────────────────
    if (!stats || stats.count < 3) {
      prices = await fetchListingPrices(buildSearchUrl(make, model, year, {}))
      stats  = computeStats(prices)
      filtersApplied = {}
      relaxed = true
    }

    if (!stats) {
      throw new Error(`[polovni] No listings found for ${make} ${model} ${year}`)
    }

    // Confidence: full filters + good sample → high; relaxed or small sample → lower
    let confidence: 'low' | 'medium' | 'high'
    if (stats.count >= 10 && !relaxed) {
      confidence = 'high'
    } else if (stats.count >= 5) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    const filterParts = [
      filtersApplied.fuelType,
      filtersApplied.transmission,
      filtersApplied.bodyType,
    ].filter(Boolean)

    const filterLabel = filterParts.length > 0
      ? `${filterParts.join(', ')}`
      : 'broad market'

    const sourceLabel = relaxed
      ? `Polovni Automobili — ${stats.count} listings (filters partially matched)`
      : `Polovni Automobili — ${stats.count} listings (${filterLabel})`

    return {
      minPrice: stats.min,
      maxPrice: stats.max,
      avgPrice: stats.avg,
      currency: 'EUR',
      confidence,
      source: sourceLabel,
      note: relaxed
        ? 'Based on broader market data — exact filters reduced results too much'
        : `Based on ${stats.count} listings (${filterLabel})`,
      listingCount: stats.count,
      filtersUsed: filtersApplied,
    }
  }
}

// Export normalisation helpers for use in other modules if needed
export { normaliseText, FUEL_NORMALISE, GEARBOX_NORMALISE, BODY_NORMALISE }
