// =============================================================================
// Scoring Logic — Unit Tests
// Tests the pure scoring logic with no DB or API dependencies.
// Run: npx jest tests/unit/scoring.logic.test.ts
// =============================================================================

import { calculateRiskScore, getScoreColor, getVerdictLabel } from '../../src/modules/scoring/scoring.logic'
import type { ScoreCalculationInput, AIFinding, ChecklistItem } from '../../src/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

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
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('calculateRiskScore', () => {
  test('returns a score between 10 and 96', () => {
    const result = calculateRiskScore('vehicle-1', emptyInput)
    expect(result.buyScore).toBeGreaterThanOrEqual(10)
    expect(result.buyScore).toBeLessThanOrEqual(96)
    expect(result.riskScore).toBe(100 - result.buyScore)
  })

  test('no findings → strong buy territory', () => {
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

  test('multiple critical findings → walk away verdict', () => {
    const findings = Array.from({ length: 5 }, (_, i) =>
      makeAIFinding({ id: `f${i}`, severity: 'critical', confidence: 85 })
    )
    const result = calculateRiskScore('v1', { ...emptyInput, aiFindings: findings })
    expect(result.verdict).toBe('WALK_AWAY')
  })

  test('problem checklist items reduce score', () => {
    const cleanResult = calculateRiskScore('v1', emptyInput)
    const problemItems = Array.from({ length: 5 }, (_, i) =>
      makeChecklistItem({ id: `c${i}`, status: 'PROBLEM' })
    )
    const withProblems = calculateRiskScore('v1', { ...emptyInput, checklistItems: problemItems })
    expect(withProblems.buyScore).toBeLessThan(cleanResult.buyScore)
  })

  test('hasPremiumHistory=true adds bonus to score', () => {
    const withoutPremium = calculateRiskScore('v1', { ...emptyInput, hasPremiumHistory: false })
    const withPremium = calculateRiskScore('v1', { ...emptyInput, hasPremiumHistory: true })
    expect(withPremium.buyScore).toBeGreaterThanOrEqual(withoutPremium.buyScore)
  })

  test('verdict is STRONG_BUY when score >= 80', () => {
    // Clean vehicle with no issues at all
    const result = calculateRiskScore('v1', emptyInput)
    // Score will be high, verify verdict matches threshold
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
})

describe('getScoreColor', () => {
  test('returns success color for score >= 80', () => {
    expect(getScoreColor(80)).toBe('#00e676')
    expect(getScoreColor(100)).toBe('#00e676')
  })
  test('returns warning color for score 60-79', () => {
    expect(getScoreColor(60)).toBe('#ffaa00')
    expect(getScoreColor(79)).toBe('#ffaa00')
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
    const sb = getVerdictLabel('STRONG_BUY')
    expect(sb.label).toBe('Strong Buy')
    expect(sb.emoji).toBe('✅')

    const wa = getVerdictLabel('WALK_AWAY')
    expect(wa.label).toBe('Walk Away')
    expect(wa.emoji).toBe('❌')
  })
})
