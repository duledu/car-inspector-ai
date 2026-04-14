// =============================================================================
// Vehicle Normalization
// Converts raw ResearchParams → canonical VehicleIdentity.
// All normalization is pure / deterministic — no I/O, no AI.
// =============================================================================

import type { ResearchParams } from '@/modules/research/research.service'
import type { BodyType, FuelType, Transmission, Drivetrain, VehicleIdentity } from './types'

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

// Year → generation fallback when model string has no generation hint
const YEAR_GENERATION_MAP: Record<string, [number, number, string][]> = {
  // [yearFrom, yearTo, generation]
  'volkswagen|golf':      [[2019, 2099, 'mk8'], [2012, 2020, 'mk7'], [2008, 2013, 'mk6'], [2003, 2009, 'mk5']],
  'volkswagen|passat':    [[2014, 2099, 'b8'],  [2010, 2015, 'b7'],  [2005, 2011, 'b6']],
  'audi|a4':              [[2015, 2099, 'b9'],  [2007, 2016, 'b8'],  [2004, 2008, 'b7']],
  'audi|a6':              [[2018, 2099, 'c8'],  [2011, 2018, 'c7'],  [2004, 2011, 'c6']],
  'bmw|3-series':         [[2018, 2099, 'g20'], [2011, 2019, 'f30'], [2004, 2012, 'e90']],
  'bmw|5-series':         [[2016, 2099, 'g30'], [2009, 2017, 'f10'], [2003, 2010, 'e60']],
  'mercedes-benz|c-class':[[2021, 2099, 'w206'],[2014, 2021, 'w205'],[2007, 2014, 'w204']],
  'mercedes-benz|e-class':[[2023, 2099, 'w214'],[2016, 2024, 'w213'],[2009, 2016, 'w212']],
  'ford|focus':           [[2011, 2099, 'mk3'], [2004, 2011, 'mk2']],
  'opel|astra':           [[2015, 2099, 'k'],   [2009, 2016, 'j'],   [2004, 2010, 'h']],
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
function engineFamilyFromCc(make: string, fuel: FuelType | null, cc: number, year: number): string | null {
  if (make === 'volkswagen' || make === 'audi' || make === 'skoda' || make === 'seat') {
    if (fuel === 'diesel') {
      if (cc >= 1900 && cc <= 2100) return year >= 2015 ? 'ea288' : 'ea189'  // 2.0 TDI
      if (cc >= 1550 && cc <= 1700) return 'ea288-16'  // 1.6 TDI — separate family to avoid SCR/AdBlue over-match
    }
    if (fuel === 'petrol') {
      if (cc >= 1750 && cc <= 2000) return 'ea888'
      if (cc >= 1100 && cc <= 1400) return 'ea211'
    }
  }
  if (make === 'bmw') {
    if (fuel === 'diesel') {
      if (cc >= 1950 && cc <= 2100) return year >= 2013 ? 'b47' : 'n47'
      if (cc >= 2990 && cc <= 3100) return year >= 2013 ? 'b57' : 'n57'
    }
    if (fuel === 'petrol') {
      if (cc >= 1990 && cc <= 2100) return year >= 2013 ? 'b48' : 'n20'
      if (cc >= 2990 && cc <= 3100) return year >= 2015 ? 'b58' : 'n55'
    }
  }
  if (make === 'mercedes-benz') {
    if (fuel === 'diesel') {
      if (cc >= 2990 && cc <= 3100) return 'om642'
      if (cc >= 2140 && cc <= 2200) return year >= 2011 ? 'om651' : 'om646'
      if (cc >= 1950 && cc <= 2100) return year >= 2019 ? 'om654' : 'om651'
    }
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
  if (lower.includes('manual') || lower === 'mt' || lower === 'm') return 'manual'
  if (lower.includes('dct') || lower.includes('dsg') || lower.includes('pdk') || lower.includes('s-tronic') || lower.includes('dualclutch') || lower.includes('dual-clutch')) return 'dct'
  if (lower.includes('cvt') || lower.includes('multitronic')) return 'cvt'
  if (lower.includes('auto') || lower === 'at' || lower === 'a') return 'automatic'
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
    drivetrain:   null,   // not in ResearchParams — future
    engineFamily,
    engineCc:     cc,
    powerKw:      kw,
    mileage:      params.mileage ?? null,
    locale:       (params.locale ?? 'en').toLowerCase().split('-')[0],
  }
}
