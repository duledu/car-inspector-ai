// =============================================================================
// Scoring Logic - Unit Tests
// Tests the pure scoring logic with no DB or API dependencies.
// Run: npx jest tests/unit/scoring.logic.test.ts
// =============================================================================

import {
  calculatePreliminaryRiskScore,
  calculateRiskScore,
  getScoreColor,
  getVerdictLabel,
  normalizeNegotiationHints,
} from '../../src/modules/scoring/scoring.logic'
import type { ScoreCalculationInput, AIFinding, ChecklistItem, VehicleHistoryResult } from '../../src/types'

const EURO = '\u20AC'
const EN_DASH = '\u2013'
const EM_DASH = '\u2014'

const euroAmount = (amount: number) => `${EURO}${amount.toLocaleString('en-US')}`
const euroRange = (min: number, max: number) => `${euroAmount(min)}${EN_DASH}${euroAmount(max)}`

const makeAIFinding = (overrides: Partial<AIFinding> = {}): AIFinding => ({
  id: 'f1',
  area: 'Rear Left Panel',
  title: 'Possible repaint',
  description: 'Test finding',
  severity: 'warning',
  confidence: 65,
  ...overrides,
})

const makeChecklistItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'c1',
  sessionId: 's1',
  category: 'EXTERIOR',
  itemKey: 'panel_alignment',
  itemLabel: 'Panel alignment',
  status: 'OK',
  ...overrides,
})

const emptyInput: ScoreCalculationInput = {
  aiFindings: [],
  checklistItems: [],
  vinData: null,
  testDriveRatings: {},
  hasPremiumHistory: false,
  askingPrice: null,
}

const makeVinHistory = (overrides: Partial<VehicleHistoryResult> = {}): VehicleHistoryResult => ({
  vin: 'WVWZZZ1JZXW000001',
  make: 'Volkswagen',
  model: 'Golf',
  year: 2018,
  accidentCount: 0,
  mileageHistory: [],
  damageHistory: [],
  ownershipHistory: [],
  theftStatus: 'clean',
  outstandingFinance: false,
  totalLoss: false,
  recalls: [],
  riskFlags: [],
  dataSource: 'test',
  fetchedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  ...overrides,
})

describe('calculateRiskScore', () => {
  test('returns a score between 10 and 96', () => {
    const result = calculateRiskScore('vehicle-1', emptyInput)
    expect(result.buyScore).toBeGreaterThanOrEqual(10)
    expect(result.buyScore).toBeLessThanOrEqual(96)
    expect(result.riskScore).toBe(100 - result.buyScore)
  })

  test('no findings keep the result in strong-buy territory', () => {
    const result = calculateRiskScore('vehicle-1', emptyInput)
    expect(result.buyScore).toBeGreaterThan(60)
  })

  test('critical AI finding significantly reduces score', () => {
    const withCritical: ScoreCalculationInput = {
      ...emptyInput,
      aiFindings: [makeAIFinding({ severity: 'critical', confidence: 90 })],
    }
    const result = calculateRiskScore('vehicle-1', withCritical)
    expect(result.buyScore).toBeLessThan(70)
  })

  test('low-confidence photo warnings have limited score impact', () => {
    const cleanResult = calculateRiskScore('v1', emptyInput)
    const lowConfidenceResult = calculateRiskScore('v1', {
      ...emptyInput,
      aiFindings: [makeAIFinding({ severity: 'warning', confidence: 35 })],
    })
    expect(cleanResult.buyScore - lowConfidenceResult.buyScore).toBeLessThanOrEqual(2)
  })

  test('multiple critical photo findings keep the result in high-risk territory', () => {
    const findings = Array.from({ length: 5 }, (_, i) =>
      makeAIFinding({ id: `f${i}`, severity: 'critical', confidence: 85 })
    )
    const result = calculateRiskScore('v1', { ...emptyInput, aiFindings: findings })
    expect(result.verdict).toBe('HIGH_RISK')
  })

  test('any actionable AI finding suppresses all-clear reasons', () => {
    const result = calculateRiskScore('mixed-ai', {
      ...emptyInput,
      aiFindings: [makeAIFinding({ severity: 'warning', confidence: 72, title: 'Paint damage' })],
      photoCount: 6,
      issuePhotoCount: 1,
    })

    expect(result.reasonsFor).not.toContain('No critical AI anomalies detected in photos')
    expect(result.dimensions.ai.explanation).toContain('Issues detected in 1 of 6 photos.')
  })

  test('ai analysis is capped out of green territory when issues affect 4 of 9 photos', () => {
    const findings = [
      makeAIFinding({ id: 'f1', title: 'Paint damage', severity: 'warning', confidence: 75 }),
      makeAIFinding({ id: 'f2', title: 'Paint damage', severity: 'warning', confidence: 78 }),
      makeAIFinding({ id: 'f3', title: 'Paint damage', severity: 'warning', confidence: 74 }),
      makeAIFinding({ id: 'f4', title: 'Panel mismatch', severity: 'critical', confidence: 75 }),
    ]

    const result = calculateRiskScore('v1', {
      ...emptyInput,
      aiFindings: findings,
      photoCount: 9,
      issuePhotoCount: 4,
    })

    expect(result.dimensions.ai.score).toBeLessThanOrEqual(68)
    expect(result.dimensions.ai.explanation).toBe(
      'Issues detected in 4 of 9 photos. Main concern: Panel mismatch. Confidence: 75%. Further manual inspection recommended.'
    )
    expect(result.dimensions.ai.signals?.visualMaxScore).toBeLessThanOrEqual(68)
  })

  test('sufficient clean photos can keep AI analysis in the high band', () => {
    const result = calculateRiskScore('clean-photos', {
      ...emptyInput,
      photoCount: 8,
    })

    expect(result.dimensions.ai.score).toBeGreaterThanOrEqual(90)
    expect(result.dimensions.ai.explanation).toBe(
      'No obvious issues detected from available photos. Results are advisory only.'
    )
  })

  test('no uploaded photos lowers AI confidence instead of showing a high safe score', () => {
    const result = calculateRiskScore('no-photos', emptyInput)

    expect(result.dimensions.ai.score).toBe(68)
    expect(result.dimensions.ai.explanation).toBe(
      'No photo analysis data available. Upload more clear photos for a reliable AI assessment.'
    )
    expect(result.dimensions.ai.signals?.visualMaxScore).toBe(74)
  })

  test('problem checklist items reduce score', () => {
    const cleanResult = calculateRiskScore('v1', emptyInput)
    const problemItems = Array.from({ length: 5 }, (_, i) =>
      makeChecklistItem({ id: `c${i}`, status: 'PROBLEM' })
    )
    const withProblems = calculateRiskScore('v1', { ...emptyInput, checklistItems: problemItems })
    expect(withProblems.buyScore).toBeLessThan(cleanResult.buyScore)
  })

  test('checklist categories with problems are capped out of green territory', () => {
    const result = calculateRiskScore('ext-problems', {
      ...emptyInput,
      checklistItems: [
        makeChecklistItem({ id: 'c1', category: 'EXTERIOR', status: 'PROBLEM' }),
        makeChecklistItem({ id: 'c2', category: 'EXTERIOR', status: 'WARNING' }),
        makeChecklistItem({ id: 'c3', category: 'EXTERIOR', status: 'OK' }),
      ],
    })

    expect(result.dimensions.exterior.score).toBeLessThanOrEqual(74)
    expect(result.dimensions.exterior.signals?.visualMaxScore).toBeLessThanOrEqual(74)
  })

  test('severe VIN/history issues cannot keep the category in a high score band', () => {
    const result = calculateRiskScore('vin-risk', {
      ...emptyInput,
      vinData: makeVinHistory({
        accidentCount: 3,
        totalLoss: true,
        outstandingFinance: true,
      }),
      hasPremiumHistory: true,
    })

    expect(result.dimensions.vin.score).toBeLessThanOrEqual(59)
    expect(result.dimensions.vin.signals?.visualMaxScore).toBeLessThanOrEqual(59)
  })

  test('hasPremiumHistory=true adds bonus to score', () => {
    const withoutPremium = calculateRiskScore('v1', { ...emptyInput, hasPremiumHistory: false })
    const withPremium = calculateRiskScore('v1', { ...emptyInput, hasPremiumHistory: true })
    expect(withPremium.buyScore).toBeGreaterThanOrEqual(withoutPremium.buyScore)
  })

  test('verdict is STRONG_BUY when score >= 80', () => {
    const result = calculateRiskScore('v1', emptyInput)
    if (result.buyScore >= 80) {
      expect(result.verdict).toBe('STRONG_BUY')
    }
  })

  test('reasons arrays have at most 5 entries each', () => {
    const result = calculateRiskScore('v1', emptyInput)
    expect(result.reasonsFor.length).toBeLessThanOrEqual(5)
    expect(result.reasonsAgainst.length).toBeLessThanOrEqual(5)
  })

  test('vehicleId is passed through correctly', () => {
    const vehicleId = 'test-vehicle-abc'
    const result = calculateRiskScore(vehicleId, emptyInput)
    expect(result.vehicleId).toBe(vehicleId)
  })

  test('very cheap cars keep negotiation ranges realistic and under the 30% cap', () => {
    const result = calculateRiskScore('very-cheap', {
      ...emptyInput,
      askingPrice: 500,
      serviceHistoryStatus: 'NONE',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
    })

    expect(result.negotiationHints).toContain(
      `No verified service history ${EM_DASH} negotiate a price reduction of ${euroRange(20, 70)}.`
    )
    expect(result.negotiationHints.some((hint) => hint.includes(euroAmount(150)))).toBe(false)
  })

  test('1,000 EUR cars use a realistic service-history negotiation range', () => {
    const result = calculateRiskScore('one-thousand', {
      ...emptyInput,
      askingPrice: 1_000,
      serviceHistoryStatus: 'NONE',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
    })

    expect(result.negotiationHints).toContain(
      `No verified service history ${EM_DASH} negotiate a price reduction of ${euroRange(50, 150)}.`
    )
  })

  test('2,000 EUR cars stay around a 5-15% realistic discount band', () => {
    const result = calculateRiskScore('two-thousand', {
      ...emptyInput,
      askingPrice: 2_000,
      serviceHistoryStatus: 'NONE',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
    })

    expect(result.negotiationHints).toContain(
      `No verified service history ${EM_DASH} negotiate a price reduction of ${euroRange(100, 300)}.`
    )
  })

  test('5,000 EUR cars scale to a moderate negotiation range', () => {
    const result = calculateRiskScore('five-thousand', {
      ...emptyInput,
      askingPrice: 5_000,
      serviceHistoryStatus: 'NONE',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
    })

    expect(result.negotiationHints).toContain(
      `No verified service history ${EM_DASH} negotiate a price reduction of ${euroRange(250, 600)}.`
    )
  })

  test('10,000 EUR cars remain price-aware and reasonable', () => {
    const result = calculateRiskScore('ten-thousand', {
      ...emptyInput,
      askingPrice: 10_000,
      serviceHistoryStatus: 'SUSPICIOUS',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
    })

    expect(result.negotiationHints).toContain(`Negotiate a price reduction of ${euroRange(600, 1_350)}.`)
  })

  test('20,000 EUR cars scale up cleanly while staying within hard caps', () => {
    const result = calculateRiskScore('twenty-thousand', {
      ...emptyInput,
      askingPrice: 20_000,
      serviceHistoryStatus: 'NONE',
      checklistItems: [makeChecklistItem({ category: 'DOCUMENTS', itemKey: 'doc_service', status: 'PROBLEM' })],
      vinData: makeVinHistory({ accidentCount: 3 }),
      hasPremiumHistory: true,
    })

    expect(result.negotiationHints).toContain(
      `No verified service history ${EM_DASH} negotiate a price reduction of ${euroRange(1_000, 2_400)}.`
    )
    expect(result.negotiationHints).toContain(
      `3 recorded accidents ${EM_DASH} negotiate at least ${euroAmount(1_700)} off asking price.`
    )
  })
})

describe('normalizeNegotiationHints', () => {
  test('preserves a valid mid/high-value range containing 2,000 EUR', () => {
    expect(
      normalizeNegotiationHints([`Negotiate a price reduction of ${euroRange(2_000, 3_200)}.`], 22_000)
    ).toEqual([`Negotiate a price reduction of ${euroRange(2_000, 3_200)}.`])
  })

  test('removes generic placeholder and duplicate hints while keeping realistic advice', () => {
    expect(
      normalizeNegotiationHints([
        '  Placeholder negotiation text  ',
        `Negotiate a price reduction of ${euroRange(400, 900)}.`,
        `Negotiate a price reduction of ${euroRange(400, 900)}.`,
        'Use {{amount}} here',
      ], 9_000)
    ).toEqual([`Negotiate a price reduction of ${euroRange(400, 900)}.`])
  })

  test('drops obviously unrealistic negotiation hints for the vehicle price', () => {
    expect(
      normalizeNegotiationHints([`Negotiate a price reduction of ${euroRange(9_000, 12_000)}.`], 14_000)
    ).toEqual([])
  })
})

describe('calculatePreliminaryRiskScore', () => {
  test('reweights only completed sections for the preliminary score', () => {
    const partialInput: ScoreCalculationInput = {
      ...emptyInput,
      checklistItems: [
        makeChecklistItem({ id: 'ext-1', category: 'EXTERIOR', itemKey: 'ext_paint', status: 'OK' }),
        makeChecklistItem({ id: 'ext-2', category: 'EXTERIOR', itemKey: 'ext_rust', status: 'OK' }),
        makeChecklistItem({ id: 'doc-1', category: 'DOCUMENTS', itemKey: 'doc_service', status: 'OK' }),
      ],
    }

    const finalLike = calculateRiskScore('vehicle-1', partialInput)
    const preliminary = calculatePreliminaryRiskScore('vehicle-1', partialInput, {
      exterior: true,
      documents: true,
    })

    expect(preliminary.buyScore).toBeGreaterThan(finalLike.buyScore)
    expect(preliminary.serviceHistoryStatus).toBe('FULL')
  })

  test('does not apply service-history penalties before that input exists', () => {
    const partialInput: ScoreCalculationInput = {
      ...emptyInput,
      checklistItems: [
        makeChecklistItem({ id: 'ext-1', category: 'EXTERIOR', itemKey: 'ext_paint', status: 'WARNING' }),
      ],
    }

    const preliminary = calculatePreliminaryRiskScore('vehicle-1', partialInput, {
      exterior: true,
    })

    expect(preliminary.serviceHistoryStatus).toBe('PARTIAL')
    expect(preliminary.riskFlags).not.toContain('NO_SERVICE_HISTORY')
  })
})

describe('getScoreColor', () => {
  test('returns strong green for score >= 90', () => {
    expect(getScoreColor(90)).toBe('#00e676')
    expect(getScoreColor(100)).toBe('#00e676')
  })

  test('returns light green for score 75-89', () => {
    expect(getScoreColor(75)).toBe('#84cc16')
    expect(getScoreColor(89)).toBe('#84cc16')
  })

  test('returns warning color for score 60-74', () => {
    expect(getScoreColor(60)).toBe('#ffaa00')
    expect(getScoreColor(74)).toBe('#ffaa00')
  })

  test('returns orange for score 40-59', () => {
    expect(getScoreColor(40)).toBe('#ff7700')
  })

  test('returns danger color for score < 40', () => {
    expect(getScoreColor(39)).toBe('#ff4757')
    expect(getScoreColor(0)).toBe('#ff4757')
  })
})

describe('getVerdictLabel', () => {
  test('maps each verdict to label + emoji + color', () => {
    const strongBuy = getVerdictLabel('STRONG_BUY')
    expect(strongBuy.label).toBe('Strong Buy')
    expect(strongBuy.emoji).toBe('\u2705')

    const caution = getVerdictLabel('BUY_WITH_CAUTION')
    expect(caution.label).toBe('Buy with Caution')
    expect(caution.emoji).toBe('\u26A0\uFE0F')

    const highRisk = getVerdictLabel('HIGH_RISK')
    expect(highRisk.label).toBe('High Risk')
    expect(highRisk.emoji).toBe('\uD83D\uDD36')

    const walkAway = getVerdictLabel('WALK_AWAY')
    expect(walkAway.label).toBe('Walk Away')
    expect(walkAway.emoji).toBe('\u274C')
  })
})

// =============================================================================
// Vehicle isolation — empty/stale checklist handling
//
// These tests document the invariants the vehicle-switch bug fix relies on.
// Root cause: Zustand hydrated Vehicle A's checklist into the store before
// initSession(vehicleB) completed; the report page guard (checklistOwned) now
// passes empty arrays to these scoring functions when session.vehicleId mismatches.
// =============================================================================

describe('vehicle isolation — checklist ownership guard', () => {
  const vehicleAItems: ChecklistItem[] = [
    makeChecklistItem({ id: 'a1', category: 'EXTERIOR',   itemKey: 'ext_paint',   status: 'OK' }),
    makeChecklistItem({ id: 'a2', category: 'INTERIOR',   itemKey: 'int_seats',   status: 'OK' }),
    makeChecklistItem({ id: 'a3', category: 'MECHANICAL', itemKey: 'mech_start',  status: 'OK' }),
    makeChecklistItem({ id: 'a4', category: 'DOCUMENTS',  itemKey: 'doc_service', status: 'OK' }),
    makeChecklistItem({ id: 'a5', category: 'TEST_DRIVE', itemKey: 'td_accel',    status: 'OK' }),
  ]

  test('empty checklistItems produce "not completed" explanation for every checklist dimension', () => {
    const result = calculateRiskScore('vehicle-b', { ...emptyInput, checklistItems: [] })

    expect(result.dimensions.exterior.explanation).toBe('Checklist not completed for this section.')
    expect(result.dimensions.interior.explanation).toBe('Checklist not completed for this section.')
    expect(result.dimensions.mechanical.explanation).toBe('Checklist not completed for this section.')
    expect(result.dimensions.documents.explanation).toBe('Checklist not completed for this section.')
  })

  test('preliminary score with only AI dimension completed excludes checklist dimensions from weighted average', () => {
    const input: ScoreCalculationInput = {
      ...emptyInput,
      aiFindings:     [makeAIFinding({ severity: 'info', confidence: 60 })],
      photoCount:     1,
      checklistItems: [],
    }
    const completedDimensions = {
      ai:         true,
      exterior:   false,
      interior:   false,
      mechanical: false,
      testDrive:  false,
      documents:  false,
      vin:        false,
    }

    const result = calculatePreliminaryRiskScore('vehicle-b', input, completedDimensions)

    expect(result.dimensions.exterior.explanation).toBe('Checklist not completed for this section.')
    expect(result.dimensions.mechanical.explanation).toBe('Checklist not completed for this section.')
    expect(result.dimensions.documents.explanation).toBe('Checklist not completed for this section.')
    expect(result.buyScore).toBeGreaterThanOrEqual(10)
    expect(result.buyScore).toBeLessThanOrEqual(96)
  })

  test('guarded (empty) vs unguarded (stale Vehicle A) inputs produce different preliminary scores', () => {
    const aiInput = {
      aiFindings:      [makeAIFinding({ severity: 'warning', confidence: 72 })],
      photoCount:      1,
      issuePhotoCount: 1,
    }

    const guardedResult = calculatePreliminaryRiskScore('vehicle-b', {
      ...emptyInput, ...aiInput,
      checklistItems: [],
    }, { ai: true, exterior: false, interior: false, mechanical: false, testDrive: false, documents: false, vin: false })

    const staleResult = calculatePreliminaryRiskScore('vehicle-b', {
      ...emptyInput, ...aiInput,
      checklistItems: vehicleAItems,
    }, { ai: true, exterior: true, interior: true, mechanical: true, testDrive: true, documents: true, vin: false })

    // Stale path inflates score by including Vehicle A's all-OK dimensions.
    expect(staleResult.buyScore).toBeGreaterThan(guardedResult.buyScore)
  })

  test('preliminary with all completedDimensions false falls back to calculateRiskScore baseline', () => {
    const result   = calculatePreliminaryRiskScore('vehicle-b', emptyInput, {
      ai: false, exterior: false, interior: false, mechanical: false, testDrive: false, documents: false, vin: false,
    })
    const baseline = calculateRiskScore('vehicle-b', emptyInput)

    expect(result.buyScore).toBe(baseline.buyScore)
    expect(result.verdict).toBe(baseline.verdict)
  })
})
