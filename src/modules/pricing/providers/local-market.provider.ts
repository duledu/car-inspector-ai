// =============================================================================
// Local Market Provider — Serbia used-car price estimator
// PRIMARY provider. Knowledge-based model calibrated to the Serbian market.
// Simulates what a real Polovni Automobili / Oglasi scrape would return.
//
// Methodology:
//   1. Classify vehicle → segment → new-car EUR base price (Serbia market)
//   2. Apply age depreciation curve (Serbia market is ~15% below EU)
//   3. Apply engine-size adjustment
//   4. Return range (avg ± spread based on market segment spread)
// =============================================================================

import type { VehiclePriceProviderInterface, PriceQuery, MarketPriceResult } from '../provider.interface'

// ─── Segment base prices (new-car EUR equivalent, Serbia 2024) ────────────────

type Segment =
  | 'mini' | 'city' | 'compact' | 'midsize'
  | 'premium_entry' | 'premium_mid' | 'premium_large'
  | 'suv_compact' | 'suv_mid' | 'suv_premium' | 'suv_large'
  | 'van' | 'pickup' | 'sports'

// [mid-point EUR, spread fraction]  spread defines how wide the range is
const SEGMENT_PRICE: Record<Segment, [number, number]> = {
  mini:           [14_000, 0.22],
  city:           [19_000, 0.2],
  compact:        [27_000, 0.2],
  midsize:        [38_000, 0.22],
  premium_entry:  [48_000, 0.24],
  premium_mid:    [65_000, 0.26],
  premium_large:  [85_000, 0.28],
  suv_compact:    [32_000, 0.22],
  suv_mid:        [43_000, 0.24],
  suv_premium:    [62_000, 0.26],
  suv_large:      [90_000, 0.28],
  van:            [30_000, 0.24],
  pickup:         [38_000, 0.24],
  sports:         [55_000, 0.3],
}

// ─── Model → segment lookup ───────────────────────────────────────────────────

// key: `${make.lower} ${model.lower}` (partial match)
const MODEL_SEGMENT: Array<[string, Segment]> = [
  // VW
  ['volkswagen up',      'mini'],
  ['volkswagen polo',    'city'],
  ['volkswagen golf',    'compact'],
  ['volkswagen jetta',   'compact'],
  ['volkswagen passat',  'midsize'],
  ['volkswagen arteon',  'premium_mid'],
  ['volkswagen tiguan',  'suv_mid'],
  ['volkswagen touareg', 'suv_large'],
  ['volkswagen t-roc',   'suv_compact'],
  ['volkswagen t-cross', 'suv_compact'],
  // BMW
  ['bmw 1',  'premium_entry'],
  ['bmw 2',  'premium_entry'],
  ['bmw 3',  'premium_mid'],
  ['bmw 4',  'premium_mid'],
  ['bmw 5',  'premium_large'],
  ['bmw 6',  'premium_large'],
  ['bmw 7',  'premium_large'],
  ['bmw x1', 'suv_compact'],
  ['bmw x2', 'suv_compact'],
  ['bmw x3', 'suv_premium'],
  ['bmw x4', 'suv_premium'],
  ['bmw x5', 'suv_large'],
  ['bmw x6', 'suv_large'],
  // Mercedes
  ['mercedes a',    'premium_entry'],
  ['mercedes b',    'premium_entry'],
  ['mercedes c',    'premium_mid'],
  ['mercedes e',    'premium_large'],
  ['mercedes s',    'premium_large'],
  ['mercedes gla',  'suv_compact'],
  ['mercedes glb',  'suv_compact'],
  ['mercedes glc',  'suv_premium'],
  ['mercedes gle',  'suv_large'],
  ['mercedes gls',  'suv_large'],
  // Audi
  ['audi a1', 'premium_entry'],
  ['audi a3', 'premium_entry'],
  ['audi a4', 'premium_mid'],
  ['audi a5', 'premium_mid'],
  ['audi a6', 'premium_large'],
  ['audi a7', 'premium_large'],
  ['audi a8', 'premium_large'],
  ['audi q2', 'suv_compact'],
  ['audi q3', 'suv_compact'],
  ['audi q5', 'suv_premium'],
  ['audi q7', 'suv_large'],
  ['audi q8', 'suv_large'],
  // Opel / Vauxhall
  ['opel corsa',    'city'],
  ['opel astra',    'compact'],
  ['opel insignia', 'midsize'],
  ['opel mokka',    'suv_compact'],
  ['opel grandland','suv_mid'],
  // Ford
  ['ford fiesta', 'city'],
  ['ford focus',  'compact'],
  ['ford mondeo', 'midsize'],
  ['ford puma',   'suv_compact'],
  ['ford kuga',   'suv_mid'],
  ['ford ranger', 'pickup'],
  // Peugeot
  ['peugeot 108', 'mini'],
  ['peugeot 208', 'city'],
  ['peugeot 308', 'compact'],
  ['peugeot 508', 'midsize'],
  ['peugeot 2008','suv_compact'],
  ['peugeot 3008','suv_mid'],
  ['peugeot 5008','suv_mid'],
  // Renault
  ['renault twingo', 'mini'],
  ['renault clio',   'city'],
  ['renault megane', 'compact'],
  ['renault laguna', 'midsize'],
  ['renault captur', 'suv_compact'],
  ['renault kadjar', 'suv_mid'],
  // Skoda
  ['skoda fabia',  'city'],
  ['skoda octavia','compact'],
  ['skoda superb', 'midsize'],
  ['skoda karoq',  'suv_compact'],
  ['skoda kodiaq', 'suv_mid'],
  // Seat / Cupra
  ['seat ibiza', 'city'],
  ['seat leon',  'compact'],
  ['seat ateca', 'suv_compact'],
  ['seat tarraco','suv_mid'],
  // Toyota
  ['toyota yaris',  'city'],
  ['toyota corolla','compact'],
  ['toyota camry',  'midsize'],
  ['toyota rav4',   'suv_mid'],
  ['toyota chr',    'suv_compact'],
  ['toyota land cruiser','suv_large'],
  // Hyundai
  ['hyundai i10', 'mini'],
  ['hyundai i20', 'city'],
  ['hyundai i30', 'compact'],
  ['hyundai tucson',  'suv_mid'],
  ['hyundai santa fe','suv_large'],
  // Kia
  ['kia rio',      'city'],
  ['kia ceed',     'compact'],
  ['kia sportage', 'suv_mid'],
  ['kia sorento',  'suv_large'],
  // Mazda
  ['mazda 2', 'city'],
  ['mazda 3', 'compact'],
  ['mazda 6', 'midsize'],
  ['mazda cx-3', 'suv_compact'],
  ['mazda cx-5', 'suv_mid'],
  // Nissan
  ['nissan micra',   'city'],
  ['nissan qashqai', 'suv_mid'],
  ['nissan x-trail', 'suv_large'],
  // Honda
  ['honda jazz',   'city'],
  ['honda civic',  'compact'],
  ['honda accord', 'midsize'],
  ['honda cr-v',   'suv_mid'],
  // Volvo
  ['volvo v40',  'premium_entry'],
  ['volvo v60',  'premium_mid'],
  ['volvo v90',  'premium_large'],
  ['volvo s60',  'premium_mid'],
  ['volvo xc40', 'suv_compact'],
  ['volvo xc60', 'suv_premium'],
  ['volvo xc90', 'suv_large'],
  // Fiat
  ['fiat 500',   'mini'],
  ['fiat punto', 'city'],
  ['fiat tipo',  'compact'],
  // Citroen
  ['citroen c1', 'mini'],
  ['citroen c3', 'city'],
  ['citroen c4', 'compact'],
  ['citroen c5', 'midsize'],
  // Subaru
  ['subaru impreza', 'compact'],
  ['subaru forester','suv_mid'],
  ['subaru outback', 'suv_mid'],
  // Mitsubishi
  ['mitsubishi colt',    'city'],
  ['mitsubishi lancer',  'compact'],
  ['mitsubishi outlander','suv_mid'],
  ['mitsubishi pajero',  'suv_large'],
  // Porsche / sports
  ['porsche 911',     'sports'],
  ['porsche cayenne', 'suv_large'],
  ['porsche macan',   'suv_premium'],
  // Dacia (budget)
  ['dacia sandero', 'city'],
  ['dacia logan',   'compact'],
  ['dacia duster',  'suv_compact'],
]

// ─── Make-level fallback segments ─────────────────────────────────────────────

const MAKE_SEGMENT: Record<string, Segment> = {
  'volkswagen': 'compact', 'vw': 'compact',
  'bmw': 'premium_mid', 'mercedes': 'premium_mid', 'mercedes-benz': 'premium_mid',
  'audi': 'premium_mid', 'volvo': 'premium_mid',
  'ford': 'compact', 'opel': 'compact', 'vauxhall': 'compact',
  'peugeot': 'compact', 'renault': 'compact', 'citroen': 'compact',
  'fiat': 'city', 'dacia': 'city', 'seat': 'compact', 'skoda': 'compact',
  'toyota': 'compact', 'honda': 'compact', 'mazda': 'compact',
  'hyundai': 'compact', 'kia': 'compact', 'nissan': 'compact',
  'subaru': 'compact', 'mitsubishi': 'compact',
  'porsche': 'sports', 'jaguar': 'premium_large', 'lexus': 'premium_mid',
  'land rover': 'suv_large', 'range rover': 'suv_large', 'jeep': 'suv_mid',
}

// ─── Depreciation curve ───────────────────────────────────────────────────────
// Returns fraction of new-car price remaining after `age` years (Serbia market)

function depreciation(age: number): number {
  const curve: Record<number, number> = {
    0: 1, 1: 0.82, 2: 0.72, 3: 0.63, 4: 0.55, 5: 0.48,
    6: 0.42, 7: 0.37, 8: 0.33, 9: 0.29, 10: 0.26,
    11: 0.23, 12: 0.2, 13: 0.18, 14: 0.16, 15: 0.14,
  }
  if (age <= 0) return 1
  if (age >= 15) return Math.max(0.08, 0.14 - (age - 15) * 0.01)
  // Interpolate
  const lo = curve[Math.floor(age)]
  const hi = curve[Math.ceil(age)]
  return lo + (hi - lo) * (age - Math.floor(age))
}

// ─── Engine-size multiplier ───────────────────────────────────────────────────

function engineMultiplier(engineCc?: number): number {
  if (!engineCc) return 1
  if (engineCc < 1200) return 0.9
  if (engineCc < 1700) return 1
  if (engineCc < 2100) return 1.05
  if (engineCc < 2600) return 1.14
  if (engineCc < 3200) return 1.24
  return 1.38
}

// ─── Filter-based multipliers (Serbia market calibrated) ─────────────────────
// Diesel holds value better; automatics command a premium; EVs are scarce/premium

function fuelMultiplier(fuelType?: string): number {
  switch (fuelType) {
    case 'diesel':   return 1.08  // Diesel popular, holds value
    case 'hybrid':   return 1.1   // Hybrid premium
    case 'electric': return 1.15  // EV scarce, premium priced
    case 'lpg':      return 0.95  // LPG slight discount (conversion stigma)
    default:         return 1     // petrol = baseline
  }
}

function transmissionMultiplier(transmission?: string): number {
  return transmission === 'automatic' || transmission === 'dct' || transmission === 'cvt' ? 1.08 : 1
}

function bodyMultiplier(bodyType?: string): number {
  switch (bodyType) {
    case 'wagon':   return 1.03  // Wagons hold slight premium in Serbia
    case 'coupe':   return 1.05  // Coupes are rarer, premium
    case 'suv':     return 1.04  // SUVs in demand
    default:        return 1
  }
}

// ─── Segment resolver ─────────────────────────────────────────────────────────

function resolveSegment(make: string, model: string): Segment {
  const key = `${make.toLowerCase()} ${model.toLowerCase()}`

  for (const [pattern, segment] of MODEL_SEGMENT) {
    if (key.includes(pattern)) return segment
  }

  return MAKE_SEGMENT[make.toLowerCase()] ?? 'compact'
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class LocalMarketProvider implements VehiclePriceProviderInterface {
  readonly providerId = 'local-market'
  readonly providerName = 'Serbia Market Estimate (Polovni Automobili pattern)'

  isAvailable(): boolean {
    // Always available — pure computation, no external calls
    return true
  }

  async getMarketPrice(query: PriceQuery): Promise<MarketPriceResult> {
    const { make, model, year, engineCc, fuelType, transmission, bodyType } = query
    const age = new Date().getFullYear() - year

    const segment = resolveSegment(make, model)
    const [baseNew, spread] = SEGMENT_PRICE[segment]

    const depr    = depreciation(age)
    const engMul  = engineMultiplier(engineCc)
    const fuelMul = fuelMultiplier(fuelType)
    const transMul = transmissionMultiplier(transmission)
    const bodyMul  = bodyMultiplier(bodyType)

    const midPoint = Math.round(baseNew * depr * engMul * fuelMul * transMul * bodyMul)

    const halfSpread = Math.round(midPoint * spread * 0.5)
    const minPrice = Math.max(500, Math.round((midPoint - halfSpread) / 100) * 100)
    const maxPrice = Math.round((midPoint + halfSpread) / 100) * 100
    const avgPrice = Math.round(midPoint / 100) * 100

    // Confidence: higher for common vehicles, lower for older/unusual ones
    let confidence: 'low' | 'medium' | 'high' = 'medium'
    const isWellKnownMake = Object.keys(MAKE_SEGMENT).includes(make.toLowerCase())
    if (isWellKnownMake && age <= 12) confidence = 'high'
    if (!isWellKnownMake || age > 18) confidence = 'low'

    const filtersApplied = Object.fromEntries(
      Object.entries({ fuelType, transmission, bodyType }).filter(([, v]) => v != null)
    )

    return {
      minPrice,
      maxPrice,
      avgPrice,
      currency: 'EUR',
      confidence,
      source: 'Serbia market model (Polovni Automobili pattern)',
      note: `Based on ${segment.replace('_', ' ')} segment, ${age}-year depreciation`,
      listingCount: 0,
      filtersUsed: filtersApplied,
    }
  }
}
