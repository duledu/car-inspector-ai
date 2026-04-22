// =============================================================================
// Vehicle Intelligence — Unit Tests
// Covers: normalization, matcher specificity, year range, drivetrain,
//         transmission, mileage window, deduplication
// =============================================================================

import { normalizeVehicle }    from '../src/lib/vehicle/normalize'
import { matchIssues }         from '../src/lib/vehicle/matcher'
import { buildKbResearchSections, deduplicateAiSections, VehicleResearchService } from '../src/modules/research/research.service'
import { allIssues } from '../data/vehicle-issues'
import type { VehicleIssue }   from '../src/lib/vehicle/types'
import type { ResearchParams } from '../src/modules/research/research.service'
import { pricingService } from '../src/modules/pricing/pricing.service'

// ─── Normalize ────────────────────────────────────────────────────────────────

describe('normalizeVehicle — make aliases', () => {
  it('vw → volkswagen', () => {
    const id = normalizeVehicle(base({ make: 'VW', model: 'Golf', year: 2016 }))
    expect(id.make).toBe('volkswagen')
  })
  it('merc → mercedes-benz', () => {
    const id = normalizeVehicle(base({ make: 'Merc', model: 'C-Class', year: 2018 }))
    expect(id.make).toBe('mercedes-benz')
  })
  it('range rover → land-rover', () => {
    const id = normalizeVehicle(base({ make: 'Range Rover', model: 'Sport', year: 2020 }))
    expect(id.make).toBe('land-rover')
  })
  it('unknown make passes through lowercased', () => {
    const id = normalizeVehicle(base({ make: 'Lada', model: 'Niva', year: 2005 }))
    expect(id.make).toBe('lada')
  })
})

describe('normalizeVehicle — model + generation from text', () => {
  it('golf mk7 extracted from model string', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf MK7', year: 2016 }))
    expect(id.model).toBe('golf')
    expect(id.generation).toBe('mk7')
  })
  it('golf 8 → mk8', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf 8', year: 2021 }))
    expect(id.model).toBe('golf')
    expect(id.generation).toBe('mk8')
  })
  it('3 series → 3-series (model normalised)', () => {
    const id = normalizeVehicle(base({ make: 'bmw', model: '3 Series', year: 2015 }))
    expect(id.model).toBe('3-series')
  })
  it('c class → c-class', () => {
    const id = normalizeVehicle(base({ make: 'mercedes-benz', model: 'C Class', year: 2016 }))
    expect(id.model).toBe('c-class')
  })
})

describe('normalizeVehicle — year → generation inference', () => {
  it('2016 VW Golf → mk7', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016 }))
    expect(id.generation).toBe('mk7')
  })
  it('2021 VW Golf → mk8', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2021 }))
    expect(id.generation).toBe('mk8')
  })
  it('2018 BMW 3-series → f30', () => {
    const id = normalizeVehicle(base({ make: 'bmw', model: '3-series', year: 2018 }))
    expect(id.generation).toBe('f30')
  })
  it('2019 BMW 3-series → g20', () => {
    const id = normalizeVehicle(base({ make: 'bmw', model: '3-series', year: 2019 }))
    expect(id.generation).toBe('g20')
  })
  it('2022 Mercedes C-Class → w206', () => {
    const id = normalizeVehicle(base({ make: 'mercedes-benz', model: 'C-Class', year: 2022 }))
    expect(id.generation).toBe('w206')
  })
  it('2021 Mercedes C-Class → w205 (not w206 — launched 2022)', () => {
    const id = normalizeVehicle(base({ make: 'mercedes-benz', model: 'C-Class', year: 2021 }))
    expect(id.generation).toBe('w205')
  })
  it('unknown make/model → generation is null', () => {
    const id = normalizeVehicle(base({ make: 'honda', model: 'Civic', year: 2018 }))
    expect(id.generation).toBeNull()
  })
})

describe('normalizeVehicle — engine family from CC', () => {
  it('VAG diesel 2.0 TDI 2016 → ea288', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, fuelType: 'diesel', engineCc: 1968 }))
    expect(id.engineFamily).toBe('ea288')
  })
  it('VAG diesel 2.0 TDI 2013 → ea189', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2013, fuelType: 'diesel', engineCc: 1968 }))
    expect(id.engineFamily).toBe('ea189')
  })
  it('VAG petrol 2.0 TSI → ea888', () => {
    const id = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, fuelType: 'petrol', engineCc: 1984 }))
    expect(id.engineFamily).toBe('ea888')
  })
  it('BMW diesel 2.0 pre-2013 → n47', () => {
    const id = normalizeVehicle(base({ make: 'bmw', model: '3-series', year: 2010, fuelType: 'diesel', engineCc: 1995 }))
    expect(id.engineFamily).toBe('n47')
  })
  it('BMW diesel 2.0 post-2013 → b47', () => {
    const id = normalizeVehicle(base({ make: 'bmw', model: '3-series', year: 2015, fuelType: 'diesel', engineCc: 1995 }))
    expect(id.engineFamily).toBe('b47')
  })
  it('engine text takes priority over CC', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, engine: 'EA288', engineCc: 1968 }))
    expect(id.engineFamily).toBe('ea288')
  })
  it('no fuel → no engine family from CC', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, engineCc: 1968 }))
    expect(id.engineFamily).toBeNull()
  })
})

describe('normalizeVehicle — fuel + transmission + body normalisation', () => {
  it('benzin → petrol', () => {
    const id = normalizeVehicle(base({ make: 'vw', model: 'Golf', year: 2016, fuelType: 'Benzin' }))
    expect(id.fuelType).toBe('petrol')
  })
  it('DSG → dct', () => {
    const id = normalizeVehicle(base({ make: 'vw', model: 'Golf', year: 2016, transmission: 'DSG' }))
    expect(id.transmission).toBe('dct')
  })
  it('estate → estate', () => {
    const id = normalizeVehicle(base({ make: 'vw', model: 'Golf', year: 2016, bodyType: 'wagon' }))
    expect(id.bodyType).toBe('estate')
  })
})

// ─── Matcher ──────────────────────────────────────────────────────────────────

describe('matchIssues — specificity ordering', () => {
  const makeIssue = (overrides: Partial<VehicleIssue>): VehicleIssue => ({
    id:           'test-issue',
    make:         'volkswagen',
    model:        null,
    generation:   null,
    yearRange:    null,
    bodyType:     null,
    fuelType:     null,
    engineFamily: null,
    transmission: null,
    drivetrain:   null,
    title:        'Test',
    category:     'mechanical',
    severity:     'minor',
    frequency:    'occasional',
    explanation:  '',
    inspectionAdvice: '',
    confidence:   'medium',
    ...overrides,
  })

  const makeOnly    = makeIssue({ id: 'make-only',               model: null, generation: null })
  const makeModel   = makeIssue({ id: 'make-model',              model: 'golf', generation: null })
  const makeModelGen = makeIssue({ id: 'make-model-gen',         model: 'golf', generation: 'mk7' })
  const withEngine  = makeIssue({ id: 'with-engine',             model: 'golf', generation: 'mk7', engineFamily: ['ea288'] })

  const identity = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, fuelType: 'diesel', engineCc: 1968 }))

  it('more specific issues rank above broader ones', () => {
    const results = matchIssues(identity, [makeOnly, makeModel, makeModelGen, withEngine])
    const ids = results.map(r => r.id)
    // withEngine (score 140) > makeModelGen (score 80) > makeModel (score 25) > makeOnly (score 0)
    expect(ids.indexOf('with-engine')).toBeLessThan(ids.indexOf('make-model-gen'))
    expect(ids.indexOf('make-model-gen')).toBeLessThan(ids.indexOf('make-model'))
    expect(ids.indexOf('make-model')).toBeLessThan(ids.indexOf('make-only'))
  })

  it('wrong make excluded', () => {
    const bmwIssue = makeIssue({ id: 'bmw-issue', make: 'bmw' })
    const results = matchIssues(identity, [bmwIssue])
    expect(results).toHaveLength(0)
  })

  it('wrong model excluded', () => {
    const passatIssue = makeIssue({ id: 'passat-issue', model: 'passat', generation: null })
    const results = matchIssues(identity, [passatIssue])
    expect(results).toHaveLength(0)
  })

  it('wrong generation excluded', () => {
    const mk8Issue = makeIssue({ id: 'mk8-issue', model: 'golf', generation: 'mk8' })
    const results = matchIssues(identity, [mk8Issue])
    expect(results).toHaveLength(0)
  })
})

describe('matchIssues — year range logic', () => {
  const issue = (id: string, from: number, to: number): VehicleIssue => ({
    id,
    make: 'volkswagen', model: 'golf', generation: null,
    yearRange: [from, to],
    bodyType: null, fuelType: null, engineFamily: null, transmission: null, drivetrain: null,
    title: id, category: 'mechanical', severity: 'minor', frequency: 'occasional',
    explanation: '', inspectionAdvice: '', confidence: 'medium',
  })

  it('year exactly at range lower bound matches', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2008 }))
    expect(matchIssues(id, [issue('i', 2008, 2015)])).toHaveLength(1)
  })
  it('year exactly at range upper bound matches', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2015 }))
    expect(matchIssues(id, [issue('i', 2008, 2015)])).toHaveLength(1)
  })
  it('year one below lower bound excluded', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2007 }))
    expect(matchIssues(id, [issue('i', 2008, 2015)])).toHaveLength(0)
  })
  it('year one above upper bound excluded', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016 }))
    expect(matchIssues(id, [issue('i', 2008, 2015)])).toHaveLength(0)
  })
  it('null yearRange always matches', () => {
    const issue2: VehicleIssue = { ...issue('i', 0, 0), yearRange: null }
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2022 }))
    expect(matchIssues(id, [issue2])).toHaveLength(1)
  })
})

describe('matchIssues — fuel + engine family', () => {
  const mkIssue = (id: string, overrides: Partial<VehicleIssue>): VehicleIssue => ({
    id,
    make: 'volkswagen', model: 'golf', generation: null, yearRange: null,
    bodyType: null, fuelType: null, engineFamily: null, transmission: null, drivetrain: null,
    title: id, category: 'mechanical', severity: 'minor', frequency: 'occasional',
    explanation: '', inspectionAdvice: '', confidence: 'medium',
    ...overrides,
  })

  it('fuel mismatch excludes issue', () => {
    const diesel2016 = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, fuelType: 'diesel', engineCc: 1968 }))
    const petrolOnlyIssue = mkIssue('petrol-only', { fuelType: ['petrol'] })
    expect(matchIssues(diesel2016, [petrolOnlyIssue])).toHaveLength(0)
  })
  it('engine family mismatch excludes issue', () => {
    const ea288car = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, fuelType: 'diesel', engineCc: 1968 }))
    const ea189Issue = mkIssue('ea189-issue', { fuelType: ['diesel'], engineFamily: ['ea189'] })
    expect(matchIssues(ea288car, [ea189Issue])).toHaveLength(0)
  })
  it('unknown fuel on identity → issue specifying fuel excluded', () => {
    const noFuel = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016 }))
    const dieselIssue = mkIssue('diesel-issue', { fuelType: ['diesel'] })
    expect(matchIssues(noFuel, [dieselIssue])).toHaveLength(0)
  })
})

describe('matchIssues — drivetrain', () => {
  const mkIssue = (id: string, drivetrain: VehicleIssue['drivetrain']): VehicleIssue => ({
    id,
    make: 'audi', model: 'a4', generation: null, yearRange: null,
    bodyType: null, fuelType: null, engineFamily: null, transmission: null,
    drivetrain,
    title: id, category: 'mechanical', severity: 'major', frequency: 'occasional',
    explanation: '', inspectionAdvice: '', confidence: 'high',
  })

  it('drivetrain-specific issue matches when identity drivetrain unknown (does not exclude)', () => {
    const id = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017 }))
    // no drivetrain in params → null → must not be excluded
    expect(matchIssues(id, [mkIssue('awd-issue', ['awd'])])).toHaveLength(1)
  })

  it('awd issue excluded when identity is rwd', () => {
    const id = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'rwd' }))
    expect(matchIssues(id, [mkIssue('awd-issue', ['awd'])])).toHaveLength(0)
  })

  it('awd issue matches when identity is awd', () => {
    const id = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'quattro' }))
    expect(id.drivetrain).toBe('awd')
    expect(matchIssues(id, [mkIssue('awd-issue', ['awd'])])).toHaveLength(1)
  })

  it('null-drivetrain issue always matches regardless of identity drivetrain', () => {
    const awd  = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'awd' }))
    const fwd  = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'fwd' }))
    const none = normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017 }))
    const generic = mkIssue('generic', null)
    expect(matchIssues(awd,  [generic])).toHaveLength(1)
    expect(matchIssues(fwd,  [generic])).toHaveLength(1)
    expect(matchIssues(none, [generic])).toHaveLength(1)
  })
})

describe('normalizeVehicle — drivetrain aliases', () => {
  it('quattro → awd', () => {
    expect(normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'Quattro' })).drivetrain).toBe('awd')
  })
  it('xdrive → awd', () => {
    expect(normalizeVehicle(base({ make: 'bmw', model: '3-series', year: 2018, drivetrain: 'xDrive' })).drivetrain).toBe('awd')
  })
  it('4matic → awd', () => {
    expect(normalizeVehicle(base({ make: 'mercedes-benz', model: 'C-Class', year: 2018, drivetrain: '4Matic' })).drivetrain).toBe('awd')
  })
  it('4MATIC hyphenated → awd', () => {
    expect(normalizeVehicle(base({ make: 'mercedes-benz', model: 'C-Class', year: 2018, drivetrain: '4-Matic' })).drivetrain).toBe('awd')
  })
  it('4Motion → awd', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, drivetrain: '4Motion' })).drivetrain).toBe('awd')
  })
  it('all wheel drive → awd', () => {
    expect(normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, drivetrain: 'all wheel drive' })).drivetrain).toBe('awd')
  })
  it('fwd literal', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, drivetrain: 'fwd' })).drivetrain).toBe('fwd')
  })
  it('missing drivetrain → null', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016 })).drivetrain).toBeNull()
  })
})

describe('normalizeVehicle — transmission specificity', () => {
  it('dct string passes through to dct', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'dct' })).transmission).toBe('dct')
  })
  it('cvt passes through', () => {
    expect(normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2010, transmission: 'cvt' })).transmission).toBe('cvt')
  })
  it('automatic still maps to automatic', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'automatic' })).transmission).toBe('automatic')
  })
  it('S tronic alias maps to dct', () => {
    expect(normalizeVehicle(base({ make: 'audi', model: 'A4', year: 2017, transmission: 'S tronic' })).transmission).toBe('dct')
  })
  it('dual clutch alias maps to dct', () => {
    expect(normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'dual clutch automatic' })).transmission).toBe('dct')
  })
})

describe('matchIssues — transmission compatibility', () => {
  const issue = (id: string, transmission: VehicleIssue['transmission']): VehicleIssue => ({
    id,
    make: 'volkswagen', model: 'golf', generation: null, yearRange: null,
    bodyType: null, fuelType: null, engineFamily: null, transmission, drivetrain: null,
    title: id, category: 'mechanical', severity: 'major', frequency: 'common',
    explanation: '', inspectionAdvice: '', confidence: 'high',
  })

  it('dct identity matches dct-specific issue', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'DSG' }))
    expect(matchIssues(id, [issue('dct-specific', ['dct'])])).toHaveLength(1)
  })

  it('dct identity also matches broad automatic issue', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'DSG' }))
    expect(matchIssues(id, [issue('automatic-broad', ['automatic'])])).toHaveLength(1)
  })

  it('generic automatic identity does not match dct-specific issue', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'automatic' }))
    expect(matchIssues(id, [issue('dct-specific', ['dct'])])).toHaveLength(0)
  })

  it('manual identity does not match broad automatic issue', () => {
    const id = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016, transmission: 'manual' }))
    expect(matchIssues(id, [issue('automatic-broad', ['automatic'])])).toHaveLength(0)
  })
})

describe('matchIssues — mileageWindow', () => {
  const mkIssue = (id: string, mileageWindow: [number, number] | undefined): VehicleIssue => ({
    id,
    make: 'volkswagen', model: 'golf', generation: 'mk7', yearRange: null,
    bodyType: null, fuelType: null, engineFamily: null, transmission: null, drivetrain: null,
    title: id, category: 'mechanical', severity: 'major', frequency: 'common',
    explanation: '', inspectionAdvice: '', confidence: 'high',
    mileageWindow,
  })

  const idAt = (mileage: number | undefined) =>
    normalizeVehicle(base({ make: 'volkswagen', model: 'Golf MK7', year: 2016, mileage }))

  it('issue with matching mileage window scores higher than same issue without window', () => {
    const inWindow  = mkIssue('in-window',  [80000, 200000])
    const noWindow  = mkIssue('no-window',  undefined)
    const results   = matchIssues(idAt(120000), [inWindow, noWindow])
    const inIdx     = results.findIndex(r => r.id === 'in-window')
    const noIdx     = results.findIndex(r => r.id === 'no-window')
    // in-window gets +5 bonus → ranks first
    expect(inIdx).toBeLessThan(noIdx)
  })

  it('issue outside mileage window still surfaces (not excluded), just no bonus', () => {
    const outsideWindow = mkIssue('outside', [150000, 300000])
    // 30k km — outside the window
    expect(matchIssues(idAt(30000), [outsideWindow])).toHaveLength(1)
  })

  it('mileage window issue still surfaces when mileage unknown', () => {
    const windowed = mkIssue('windowed', [80000, 200000])
    // no mileage in params
    expect(matchIssues(idAt(undefined), [windowed])).toHaveLength(1)
  })

  it('no bonus when mileage unknown', () => {
    const inWindow  = mkIssue('in',  [80000, 200000])
    const noWindow  = mkIssue('no',  undefined)
    const results   = matchIssues(idAt(undefined), [inWindow, noWindow])
    // scores should be equal (both 0 bonus) — order determined by severity (both major)
    const inScore  = results.find(r => r.id === 'in')!.specificityScore
    const noScore  = results.find(r => r.id === 'no')!.specificityScore
    expect(inScore).toBe(noScore)
  })
})

describe('matchIssues — deduplication by id', () => {
  it('same id in allIssues appears only once in output', () => {
    const dup: VehicleIssue = {
      id: 'dup', make: 'volkswagen', model: null, generation: null, yearRange: null,
      bodyType: null, fuelType: null, engineFamily: null, transmission: null, drivetrain: null,
      title: 'dup', category: 'mechanical', severity: 'minor', frequency: 'occasional',
      explanation: '', inspectionAdvice: '', confidence: 'medium',
    }
    const identity = normalizeVehicle(base({ make: 'volkswagen', model: 'Golf', year: 2016 }))
    const results = matchIssues(identity, [dup, dup, dup])
    expect(results.filter(r => r.id === 'dup')).toHaveLength(1)
  })
})

// ─── KB vs AI deduplication ───────────────────────────────────────────────────

describe('deduplicateAiSections', () => {
  const baseSection = () => ({
    id: 'commonProblems',
    title: 'Common Problems',
    items: [
      { title: 'Timing chain stretch EA288 2.0 TDI', description: 'desc', severity: 'high' as const, tags: [] },
      { title: 'Something completely new',           description: 'desc', severity: 'medium' as const, tags: [] },
    ],
  })

  const sections = () => ({
    commonProblems:      baseSection(),
    highPriorityChecks:  { id: 'h', title: 'h', items: [] },
    visualAttention:     { id: 'v', title: 'v', items: [] },
    mechanicalWatchouts: { id: 'm', title: 'm', items: [] },
    testDriveFocus:      { id: 't', title: 't', items: [] },
    costAwareness:       { id: 'c', title: 'c', items: [] },
  })

  it('removes AI item whose title matches a KB issue title', () => {
    const kbIssue = {
      id: 'vw-golf-mk7-ea288-timing-chain',
      title: 'Timing chain stretch (EA288 2.0 TDI)',
    } as Parameters<typeof deduplicateAiSections>[1][0]

    const result = deduplicateAiSections(sections(), [kbIssue])
    const titles = result.commonProblems.items.map(i => i.title)
    expect(titles).not.toContain('Timing chain stretch EA288 2.0 TDI')
    expect(titles).toContain('Something completely new')
  })

  it('keeps AI item when no KB title overlaps', () => {
    const kbIssue = { id: 'x', title: 'AdBlue pump failure' } as Parameters<typeof deduplicateAiSections>[1][0]
    const result = deduplicateAiSections(sections(), [kbIssue])
    expect(result.commonProblems.items).toHaveLength(2)
  })

  it('returns sections unchanged when kbIssues is empty', () => {
    const s = sections()
    const result = deduplicateAiSections(s, [])
    expect(result).toBe(s)
  })
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('buildKbResearchSections - model-specific overview content', () => {
  function sectionTitlesFor(params: ResearchParams): string[] {
    const identity = normalizeVehicle(params)
    const matches = matchIssues(identity, allIssues, 12)
    const sections = buildKbResearchSections(matches, params.locale)
    return [
      ...sections.commonProblems.items.map(item => item.title),
      ...sections.highPriorityChecks.items.map(item => item.title),
      ...sections.visualAttention.items.map(item => item.title),
      ...sections.mechanicalWatchouts.items.map(item => item.title),
      ...sections.testDriveFocus.items.map(item => item.title),
      ...sections.costAwareness.items.map(item => item.title),
    ]
  }

  it('surfaces distinct Audi A4, BMW 3 Series, and VW Golf guidance', () => {
    const audi = sectionTitlesFor(base({
      make: 'Audi',
      model: 'A4',
      year: 2017,
      fuelType: 'petrol',
      engineCc: 1984,
      transmission: 'S tronic',
    }))
    const bmw = sectionTitlesFor(base({
      make: 'BMW',
      model: '3 Series',
      year: 2010,
      fuelType: 'diesel',
      engineCc: 1995,
    }))
    const golf = sectionTitlesFor(base({
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      fuelType: 'diesel',
      engineCc: 1968,
      transmission: 'DSG',
    }))

    expect(audi).toEqual(expect.arrayContaining(['EA888 Gen 3 oil consumption (B9 petrol)']))
    expect(bmw).toEqual(expect.arrayContaining(['N47 timing chain failure — CRITICAL']))
    expect(golf).toEqual(expect.arrayContaining(['Timing chain stretch (EA288 2.0 TDI)']))

    expect(new Set(audi)).not.toEqual(new Set(bmw))
    expect(new Set(audi)).not.toEqual(new Set(golf))
    expect(new Set(bmw)).not.toEqual(new Set(golf))
  })
})

describe('VehicleResearchService — fallback source classification', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('uses knowledge-base source without limited mode when AI is unavailable but KB data exists', async () => {
    jest.spyOn(pricingService, 'getMarketPrice').mockResolvedValue({
      providerId: 'test-provider',
      source: 'test-provider',
      confidence: 'medium',
      minPrice: 8000,
      maxPrice: 10000,
      avgPrice: 9000,
      listingCount: 12,
    })

    const service = new VehicleResearchService('')
    const result = await service.research(base({
      make: 'Volkswagen',
      model: 'Golf',
      year: 2016,
      fuelType: 'diesel',
      engineCc: 1968,
      transmission: 'DSG',
    }))

    expect(result.dataSource).toBe('knowledge_base')
    expect(result.fallbackReason).toBe('missing_ai_config')
    expect(result.limitedMode).toBe(false)
    expect(result.sections.commonProblems.items.length).toBeGreaterThan(0)
  })

  it('keeps limited mode only for generic fallback when there is no model-specific data', async () => {
    jest.spyOn(pricingService, 'getMarketPrice').mockResolvedValue({
      providerId: 'test-provider',
      source: 'test-provider',
      confidence: 'medium',
      minPrice: 3000,
      maxPrice: 5000,
      avgPrice: 4000,
      listingCount: 5,
    })

    const service = new VehicleResearchService('')
    const result = await service.research(base({
      make: 'Honda',
      model: 'Civic',
      year: 2018,
      fuelType: 'petrol',
    }))

    expect(result.dataSource).toBe('generic_fallback')
    expect(result.fallbackReason).toBe('no_model_data')
    expect(result.limitedMode).toBe(true)
  })
})

describe('VehicleResearchService — localization pass', () => {
  const pricingResult = {
    providerId: 'test-provider',
    source: 'test-provider',
    confidence: 'medium' as const,
    minPrice: 8000,
    maxPrice: 10000,
    avgPrice: 9000,
    listingCount: 12,
  }

  const englishAiResult = {
    vehicleKey: '2016 Volkswagen Golf 2.0L',
    generatedAt: '2026-04-22T00:00:00.000Z',
    confidence: 'high',
    overallRiskLevel: 'moderate',
    summary: 'English summary.',
    priceContext: {
      marketRangeFrom: 8000,
      marketRangeTo: 10000,
      avgPrice: 9000,
      evaluation: 'fair',
      evaluationLabel: 'Fair market value',
      summary: 'English price summary.',
      isEstimated: true,
      source: 'AI estimate',
      confidence: 'medium',
    },
    sections: {
      commonProblems:      { id: 'commonProblems', title: 'Česti problemi', items: [{ title: 'Timing chain stretch', description: 'English body text.', severity: 'high', tags: ['COMMON_ISSUE'] }] },
      highPriorityChecks:  { id: 'highPriorityChecks', title: 'Prioritetne provere', items: [] },
      visualAttention:     { id: 'visualAttention', title: 'Vizuelne tačke pažnje', items: [] },
      mechanicalWatchouts: { id: 'mechanicalWatchouts', title: 'Mehaničke provere', items: [] },
      testDriveFocus:      { id: 'testDriveFocus', title: 'Fokus na test vožnji', items: [] },
      costAwareness:       { id: 'costAwareness', title: 'Troškovi i pregovori', items: [] },
    },
    disclaimer: 'English disclaimer.',
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('localizes final assembled research content when Serbian is selected', async () => {
    jest.spyOn(pricingService, 'getMarketPrice').mockResolvedValue(pricingResult)

    const originalFetch = global.fetch
    ;(global as typeof globalThis & { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(englishAiResult) }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{
            text: JSON.stringify({
              ...englishAiResult,
              summary: 'Sažetak na srpskom.',
              priceContext: {
                ...englishAiResult.priceContext,
                evaluationLabel: 'U okviru tržišta',
                summary: 'Sažetak cene na srpskom.',
              },
              sections: {
                ...englishAiResult.sections,
                commonProblems: {
                  ...englishAiResult.sections.commonProblems,
                  items: [{ title: 'Istezanje lanca razvoda', description: 'Tekst kartice na srpskom.', severity: 'high', tags: ['COMMON_ISSUE'] }],
                },
              },
              disclaimer: 'Odricanje odgovornosti na srpskom.',
            }),
          }],
        }),
      }) as unknown as typeof fetch

    try {
      const service = new VehicleResearchService('test-key')
      const result = await service.research(base({
        make: 'Volkswagen',
        model: 'Golf',
        year: 2016,
        fuelType: 'diesel',
        engineCc: 1968,
        locale: 'sr',
      }))

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result.summary).toBe('Sažetak na srpskom.')
      expect(result.priceContext?.summary).toBe('Sažetak cene na srpskom.')
      expect(result.sections.commonProblems.items[0]?.title).toBe('Istezanje lanca razvoda')
      expect(result.sections.commonProblems.items[0]?.description).toBe('Tekst kartice na srpskom.')
      expect(result.disclaimer).toBe('Odricanje odgovornosti na srpskom.')
    } finally {
      ;(global as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch
    }
  })

  it('skips the localization pass when English is selected', async () => {
    jest.spyOn(pricingService, 'getMarketPrice').mockResolvedValue(pricingResult)

    const originalFetch = global.fetch
    ;(global as typeof globalThis & { fetch: jest.Mock }).fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: JSON.stringify(englishAiResult) }],
        }),
      }) as unknown as typeof fetch

    try {
      const service = new VehicleResearchService('test-key')
      const result = await service.research(base({
        make: 'Volkswagen',
        model: 'Golf',
        year: 2016,
        fuelType: 'diesel',
        engineCc: 1968,
        locale: 'en',
      }))

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(result.summary).toBe('English summary.')
      expect(result.sections.commonProblems.items[0]?.description).toContain('The EA288 2.0 TDI uses a timing chain')
      expect(result.disclaimer).toBe('English disclaimer.')
    } finally {
      ;(global as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch
    }
  })
})

function base(overrides: Partial<ResearchParams> & { make: string; model: string; year: number }): ResearchParams {
  return {
    locale: 'en',
    ...overrides,
  }
}
