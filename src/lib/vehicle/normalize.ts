// =============================================================================
// Vehicle Normalization
// Converts raw ResearchParams → canonical VehicleIdentity.
// All normalization is pure / deterministic — no I/O, no AI.
// =============================================================================

import type { ResearchParams } from '@/modules/research/research.service'
import type { BodyType, Drivetrain, FuelType, Transmission, VehicleIdentity } from './types'

// ── Make aliases ──────────────────────────────────────────────────────────────

const MAKE_ALIASES: Record<string, string> = {
  'vw':              'volkswagen',
  'vag':             'volkswagen',
  'merc':            'mercedes-benz',
  'mercedes':        'mercedes-benz',
  'mb':              'mercedes-benz',
  'benz':            'mercedes-benz',
  'bmw':             'bmw',
  'beemer':          'bmw',
  'chevy':           'chevrolet',
  'chevrolet':       'chevrolet',
  'vauxhall':        'opel',
  'holden':          'opel',
  'alfa':            'alfa romeo',
  'alfa romeo':      'alfa romeo',
  'land rover':      'land-rover',
  'landrover':       'land-rover',
  'range rover':     'land-rover',
  'rolls':           'rolls-royce',
  'rolls royce':     'rolls-royce',
}

function normalizeMake(raw: string): string {
  const lower = raw.trim().toLowerCase()
  return MAKE_ALIASES[lower] ?? lower
}

// ── Model normalization ───────────────────────────────────────────────────────

// Patterns that embed generation info — strip from model, extract separately
const MODEL_GENERATION_PATTERNS: [RegExp, string, string][] = [
  // [regex on lower model string, clean model name, generation]
  [/golf\s*(7|vii|mk7|7\.5|mk7\.5)/i,  'golf',      'mk7'],
  [/golf\s*(8|viii|mk8)/i,              'golf',      'mk8'],
  [/golf\s*(6|vi|mk6)/i,               'golf',      'mk6'],
  [/golf\s*(5|v|mk5)/i,                'golf',      'mk5'],
  [/golf\s*(4|iv|mk4)/i,               'golf',      'mk4'],
  [/passat\s*(b8)/i,                   'passat',    'b8'],
  [/passat\s*(b7)/i,                   'passat',    'b7'],
  [/passat\s*(b6)/i,                   'passat',    'b6'],
  [/passat\s*(b5)/i,                   'passat',    'b5'],
  [/a4\s*(b9)/i,                       'a4',        'b9'],
  [/a4\s*(b8)/i,                       'a4',        'b8'],
  [/a4\s*(b7)/i,                       'a4',        'b7'],
  [/a4\s*(b6)/i,                       'a4',        'b6'],
  [/a6\s*(c8)/i,                       'a6',        'c8'],
  [/a6\s*(c7)/i,                       'a6',        'c7'],
  [/a6\s*(c6)/i,                       'a6',        'c6'],
  [/3[\s-]?series\s*(g20)/i,           '3-series',  'g20'],
  [/3[\s-]?series\s*(f30)/i,           '3-series',  'f30'],
  [/3[\s-]?series\s*(e90)/i,           '3-series',  'e90'],
  [/5[\s-]?series\s*(g30)/i,           '5-series',  'g30'],
  [/5[\s-]?series\s*(f10)/i,           '5-series',  'f10'],
  [/5[\s-]?series\s*(e60)/i,           '5-series',  'e60'],
  [/c[\s-]?class\s*(w206)/i,           'c-class',   'w206'],
  [/c[\s-]?class\s*(w205)/i,           'c-class',   'w205'],
  [/c[\s-]?class\s*(w204)/i,           'c-class',   'w204'],
  [/e[\s-]?class\s*(w214)/i,           'e-class',   'w214'],
  [/e[\s-]?class\s*(w213)/i,           'e-class',   'w213'],
  [/e[\s-]?class\s*(w212)/i,           'e-class',   'w212'],
  [/focus\s*(mk3)/i,                   'focus',     'mk3'],
  [/focus\s*(mk2)/i,                   'focus',     'mk2'],
  [/astra\s*(k)/i,                     'astra',     'k'],
  [/astra\s*(j)/i,                     'astra',     'j'],
  [/astra\s*(h)/i,                     'astra',     'h'],
]

// Year → generation fallback when model string has no generation hint.
// Ranges are checked in order — first match wins — so newer generations must come first.
// IMPORTANT: Ranges are intentionally non-overlapping. When a new generation starts
// mid-year, err on the side of the older generation (buyers are more likely to have
// the outgoing model). Update these cutoffs as production data becomes clearer.
const YEAR_GENERATION_MAP: Record<string, [number, number, string][]> = {
  // [yearFrom, yearTo, generation]  (inclusive both ends, checked newest-first)
  'volkswagen|golf':       [[2020, 2099, 'mk8'], [2012, 2019, 'mk7'], [2008, 2013, 'mk6'], [2003, 2009, 'mk5']],
  'volkswagen|passat':     [[2015, 2099, 'b8'],  [2010, 2014, 'b7'],  [2005, 2011, 'b6']],
  'audi|a4':               [[2015, 2099, 'b9'],  [2007, 2016, 'b8'],  [2004, 2008, 'b7']],
  'audi|a6':               [[2019, 2099, 'c8'],  [2011, 2018, 'c7'],  [2004, 2011, 'c6']],
  // BMW G20 launched production early 2019 (2019 model year).
  // A 2018 3-series is almost always an F30 — keep 2019 as the G20 floor.
  'bmw|3-series':          [[2019, 2099, 'g20'], [2011, 2018, 'f30'], [2004, 2012, 'e90']],
  // BMW G30 5-series: full production from 2017. A 2016 5-series is still F10.
  'bmw|5-series':          [[2017, 2099, 'g30'], [2009, 2016, 'f10'], [2003, 2010, 'e60']],
  // Mercedes W206 C-Class: launched mid-2021 as a 2022 model year in most markets.
  'mercedes-benz|c-class': [[2022, 2099, 'w206'],[2014, 2021, 'w205'],[2007, 2014, 'w204']],
  // Mercedes W214 E-Class: launched 2023/2024 — 2024+ in most markets.
  'mercedes-benz|e-class': [[2024, 2099, 'w214'],[2016, 2023, 'w213'],[2009, 2016, 'w212']],
  'ford|focus':            [[2011, 2099, 'mk3'], [2004, 2011, 'mk2']],
  'opel|astra':            [[2015, 2099, 'k'],   [2009, 2016, 'j'],   [2004, 2010, 'h']],
}

interface ModelParsed {
  model: string
  generation: string | null
}

function normalizeModel(rawModel: string, make: string): ModelParsed {
  const raw = rawModel.trim().toLowerCase()

  // Check explicit model+generation patterns
  for (const [pattern, cleanModel, gen] of MODEL_GENERATION_PATTERNS) {
    if (pattern.test(raw)) {
      return { model: cleanModel, generation: gen }
    }
  }

  // Normalize common model name variants
  let model = raw
    .replace(/\b(3er|3-series|3 series)\b/i, '3-series')
    .replace(/\b(5er|5-series|5 series)\b/i, '5-series')
    .replace(/\b(c-class|c class|c klasse)\b/i, 'c-class')
    .replace(/\b(e-class|e class|e klasse)\b/i, 'e-class')
    .replace(/\b(s-class|s class|s klasse)\b/i, 's-class')
    .replace(/\b(a-class|a class)\b/i, 'a-class')
    .replace(/\s+(facelift|fl|lci|pre-fl|pre-facelift)\b/i, '')
    .trim()

  return { model, generation: null }
}

function inferGeneration(make: string, model: string, year: number): string | null {
  const key = `${make}|${model}`
  const ranges = YEAR_GENERATION_MAP[key]
  if (!ranges) return null
  for (const [from, to, gen] of ranges) {
    if (year >= from && year <= to) return gen
  }
  return null
}

// ── Engine family extraction ──────────────────────────────────────────────────

const ENGINE_FAMILY_PATTERNS: [RegExp, string][] = [
  // VW/Audi diesel
  [/ea288/i,                    'ea288'],
  [/ea189/i,                    'ea189'],
  // VW/Audi petrol
  [/ea888/i,                    'ea888'],
  [/ea111/i,                    'ea111'],
  [/ea113/i,                    'ea113'],
  // BMW diesel
  [/n47/i,                      'n47'],
  [/n57/i,                      'n57'],
  [/m57/i,                      'm57'],
  [/b47/i,                      'b47'],
  [/b57/i,                      'b57'],
  // BMW petrol
  [/n20/i,                      'n20'],
  [/n52/i,                      'n52'],
  [/n53/i,                      'n53'],
  [/n54/i,                      'n54'],
  [/n55/i,                      'n55'],
  [/b48/i,                      'b48'],
  [/b58/i,                      'b58'],
  // Mercedes diesel
  [/om642/i,                    'om642'],
  [/om651/i,                    'om651'],
  [/om654/i,                    'om654'],
  [/om611/i,                    'om611'],
  // Mercedes petrol
  [/m271/i,                     'm271'],
  [/m274/i,                     'm274'],
]

// CC + make/fuel → engine family heuristic
// Each entry: [makes[], fuel, ccMin, ccMax, yearFrom, family]
// yearFrom = 0 means "any year (no year split)"; checked in order — first match wins.
// When the same cc range maps to two families split by year, list the newer entry first.
type CcRule = [string[], FuelType, number, number, number, string]

const CC_FAMILY_RULES: CcRule[] = [
  // ── VAG (VW / Audi / Skoda / Seat) ──────────────────────────────────────
  [['volkswagen','audi','skoda','seat'], 'diesel', 1900, 2100, 2015, 'ea288'],    // 2.0 TDI post-2015
  [['volkswagen','audi','skoda','seat'], 'diesel', 1900, 2100,    0, 'ea189'],    // 2.0 TDI pre-2015
  [['volkswagen','audi','skoda','seat'], 'diesel', 1550, 1700,    0, 'ea288-16'], // 1.6 TDI
  [['volkswagen','audi','skoda','seat'], 'petrol', 1750, 2000,    0, 'ea888'],    // 1.8/2.0 TSI
  [['volkswagen','audi','skoda','seat'], 'petrol', 1100, 1400,    0, 'ea211'],    // 1.0/1.2/1.4 TSI
  // ── BMW ──────────────────────────────────────────────────────────────────
  [['bmw'], 'diesel', 1950, 2100, 2013, 'b47'],   // 2.0d post-2013
  [['bmw'], 'diesel', 1950, 2100,    0, 'n47'],   // 2.0d pre-2013
  [['bmw'], 'diesel', 2990, 3100, 2013, 'b57'],   // 3.0d post-2013
  [['bmw'], 'diesel', 2990, 3100,    0, 'n57'],   // 3.0d pre-2013
  [['bmw'], 'petrol', 1990, 2100, 2013, 'b48'],   // 2.0i post-2013
  [['bmw'], 'petrol', 1990, 2100,    0, 'n20'],   // 2.0i pre-2013
  [['bmw'], 'petrol', 2990, 3100, 2015, 'b58'],   // 3.0i post-2015
  [['bmw'], 'petrol', 2990, 3100,    0, 'n55'],   // 3.0i pre-2015
  // ── Mercedes-Benz ────────────────────────────────────────────────────────
  [['mercedes-benz'], 'diesel', 2990, 3100,    0, 'om642'],  // 3.0d
  [['mercedes-benz'], 'diesel', 2140, 2200, 2011, 'om651'],  // 2.2d post-2011
  [['mercedes-benz'], 'diesel', 2140, 2200,    0, 'om646'],  // 2.2d pre-2011
  [['mercedes-benz'], 'diesel', 1950, 2100, 2019, 'om654'],  // 2.0d post-2019
  [['mercedes-benz'], 'diesel', 1950, 2100,    0, 'om651'],  // 2.0d pre-2019
]

function engineFamilyFromCc(make: string, fuel: FuelType | null, cc: number, year: number): string | null {
  if (!fuel) return null
  for (const [makes, ruleFuel, ccMin, ccMax, yearFrom, family] of CC_FAMILY_RULES) {
    if (ruleFuel !== fuel) continue
    if (!makes.includes(make)) continue
    if (cc < ccMin || cc > ccMax) continue
    if (yearFrom > 0 && year < yearFrom) continue
    return family
  }
  return null
}

function extractEngineFamily(engineText: string | undefined, make: string, fuel: FuelType | null, cc: number | null, year: number): string | null {
  if (engineText) {
    for (const [pattern, family] of ENGINE_FAMILY_PATTERNS) {
      if (pattern.test(engineText)) return family
    }
  }
  if (cc) {
    return engineFamilyFromCc(make, fuel, cc, year)
  }
  return null
}

// ── FuelType normalization ────────────────────────────────────────────────────

function normalizeFuelType(raw: string | undefined): FuelType | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  if (lower.includes('diesel') || lower === 'd')   return 'diesel'
  if (lower.includes('petrol') || lower.includes('gasoline') || lower.includes('benzin') || lower === 'p') return 'petrol'
  if (lower.includes('hybrid'))                     return 'hybrid'
  if (lower.includes('electric') || lower === 'ev') return 'electric'
  if (lower.includes('lpg') || lower.includes('gas')) return 'lpg'
  if (lower.includes('cng'))                        return 'cng'
  return null
}

// ── Transmission normalization ────────────────────────────────────────────────

function normalizeTransmission(raw: string | undefined): Transmission | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  const compact = lower.replace(/[^a-z0-9]/g, '')
  if (lower.includes('manual') || lower === 'mt' || lower === 'm') return 'manual'
  if (lower.includes('dct') || lower.includes('dsg') || lower.includes('pdk') || lower.includes('s-tronic') || compact.includes('stronic') || compact.includes('dualclutch')) return 'dct'
  if (lower.includes('cvt') || lower.includes('multitronic')) return 'cvt'
  if (lower.includes('auto') || lower === 'at' || lower === 'a') return 'automatic'
  return null
}

// ── Drivetrain normalization ──────────────────────────────────────────────────

function normalizeDrivetrain(raw: string | undefined): Drivetrain | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  const compact = lower.replace(/[^a-z0-9]/g, '')
  if (lower === 'fwd' || lower.includes('front-wheel') || lower.includes('front wheel') || compact.includes('frontwheeldrive')) return 'fwd'
  if (lower === 'rwd' || lower.includes('rear-wheel')  || lower.includes('rear wheel')  || compact.includes('rearwheeldrive'))  return 'rwd'
  if (lower === '4wd' || lower.includes('four-wheel') || lower.includes('four wheel') || lower.includes('4x4'))                 return '4wd'
  // awd last — some brand names (quattro, xDrive, 4Matic, Haldex) all mean AWD
  if (lower === 'awd' || lower.includes('all-wheel') || lower.includes('all wheel') || lower.includes('allwheel') ||
      lower.includes('quattro') || lower.includes('xdrive') || lower.includes('4matic') ||
      lower.includes('haldex') || compact.includes('4matic') || compact.includes('4motion')) return 'awd'
  return null
}

// ── BodyType normalization ────────────────────────────────────────────────────

function normalizeBodyType(raw: string | undefined): BodyType | null {
  if (!raw) return null
  const lower = raw.trim().toLowerCase()
  if (lower.includes('sedan') || lower.includes('saloon') || lower.includes('limousine')) return 'sedan'
  if (lower.includes('hatchback') || lower.includes('hatch'))   return 'hatchback'
  if (lower.includes('estate') || lower.includes('wagon') || lower.includes('combi') || lower.includes('variant') || lower.includes('touring') || lower.includes('avant')) return 'estate'
  if (lower.includes('suv') || lower.includes('crossover'))     return 'suv'
  if (lower.includes('coupe') || lower.includes('coupé'))       return 'coupe'
  if (lower.includes('convertible') || lower.includes('cabrio') || lower.includes('cabriolet')) return 'convertible'
  if (lower.includes('minivan') || lower.includes('mpv'))       return 'minivan'
  if (lower.includes('van') || lower.includes('transporter'))   return 'van'
  if (lower.includes('pickup') || lower.includes('pick-up'))    return 'pickup'
  return null
}

// ── Main export ───────────────────────────────────────────────────────────────

export function normalizeVehicle(params: ResearchParams): VehicleIdentity {
  const make  = normalizeMake(params.make)
  const { model, generation: genFromModel } = normalizeModel(params.model, make)
  const year  = params.year
  const fuel  = normalizeFuelType(params.fuelType)
  const trans = normalizeTransmission(params.transmission)
  const body  = normalizeBodyType(params.bodyType)
  const cc    = params.engineCc ?? null
  const kw    = params.powerKw ?? null

  const generation = genFromModel ?? inferGeneration(make, model, year) ?? null

  const engineText = params.engine
  const engineFamily = extractEngineFamily(engineText, make, fuel, cc, year)

  return {
    make,
    model,
    generation,
    yearFrom: year,
    yearTo:   year,
    bodyType:     body,
    fuelType:     fuel,
    transmission: trans,
    drivetrain:   normalizeDrivetrain(params.drivetrain),
    engineFamily,
    engineCc:     cc,
    powerKw:      kw,
    mileage:      params.mileage ?? null,
    locale:       (params.locale ?? 'en').toLowerCase().split('-')[0],
  }
}
