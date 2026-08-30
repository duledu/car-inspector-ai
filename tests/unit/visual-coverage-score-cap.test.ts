// =============================================================================
// Evidence / coverage caps on the FINAL displayed assessment score
//
// A high overall score must never imply a level of confidence the
// available visual evidence doesn't support. These caps are a CEILING on
// the final score only — they never subtract points for missing photos
// (missing evidence is not proof the vehicle is bad) and never touch the
// individual, per-dimension scores. Single source of truth:
// getVisualCoverageCap / applyVisualCoverageCap in scoring.logic.ts.
// =============================================================================

import fs from 'fs'
import path from 'path'
import {
  applyVisualCoverageCap,
  getVisualCoverageCap,
  calculateRiskScore,
} from '../../src/modules/scoring/scoring.logic'
import type { ScoreCalculationInput, AIFinding, ChecklistItem } from '../../src/types'

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('getVisualCoverageCap / applyVisualCoverageCap — the exact required test matrix', () => {
  it('NOT_ASSESSED (0 valid photos): cap is 69', () => {
    expect(getVisualCoverageCap('NOT_ASSESSED')).toBe(69)
    expect(applyVisualCoverageCap(95, 'NOT_ASSESSED')).toBe(69)
    expect(applyVisualCoverageCap(88, 'NOT_ASSESSED')).toBe(69)
    expect(applyVisualCoverageCap(69, 'NOT_ASSESSED')).toBe(69)
    expect(applyVisualCoverageCap(55, 'NOT_ASSESSED')).toBe(55)
  })

  it('LIMITED (1-2 valid photos): cap is 74', () => {
    expect(getVisualCoverageCap('LIMITED')).toBe(74)
    expect(applyVisualCoverageCap(90, 'LIMITED')).toBe(74)
    expect(applyVisualCoverageCap(70, 'LIMITED')).toBe(70)
    expect(applyVisualCoverageCap(95, 'LIMITED')).toBe(74)
  })

  it('PARTIAL (3-7 valid photos): cap is 89', () => {
    expect(getVisualCoverageCap('PARTIAL')).toBe(89)
    expect(applyVisualCoverageCap(95, 'PARTIAL')).toBe(89)
    expect(applyVisualCoverageCap(82, 'PARTIAL')).toBe(82)
  })

  it('FULL (8 valid photos): no cap', () => {
    expect(getVisualCoverageCap('FULL')).toBeNull()
    expect(applyVisualCoverageCap(95, 'FULL')).toBe(95)
    expect(applyVisualCoverageCap(100, 'FULL')).toBe(100)
  })

  it('undefined/null coverage is treated as uncapped (never crashes, never invents a restriction)', () => {
    expect(getVisualCoverageCap(undefined)).toBeNull()
    expect(getVisualCoverageCap(null)).toBeNull()
    expect(applyVisualCoverageCap(77, undefined)).toBe(77)
  })

  it('the cap is a ceiling only — it never raises a score below it', () => {
    expect(applyVisualCoverageCap(10, 'NOT_ASSESSED')).toBe(10)
    expect(applyVisualCoverageCap(30, 'LIMITED')).toBe(30)
    expect(applyVisualCoverageCap(40, 'PARTIAL')).toBe(40)
  })
})

const makeAIFinding = (overrides: Partial<AIFinding> = {}): AIFinding => ({
  id: 'f1', area: 'Rear Left Panel', title: 'Possible repaint', description: 'Test finding',
  severity: 'warning', confidence: 65, ...overrides,
})

const makeChecklistItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'c1', sessionId: 's1', category: 'EXTERIOR', itemKey: 'panel_alignment', itemLabel: 'Panel alignment', status: 'OK', ...overrides,
})

const emptyInput: ScoreCalculationInput = {
  aiFindings: [], checklistItems: [], vinData: null, testDriveRatings: {}, hasPremiumHistory: false, askingPrice: null,
}

const cleanChecklist = (['EXTERIOR', 'INTERIOR', 'MECHANICAL', 'DOCUMENTS'] as const).flatMap((category) =>
  Array.from({ length: 4 }, (_, i) => makeChecklistItem({ id: `${category}-${i}`, category, status: 'OK' }))
)

describe('calculateRiskScore — the cap applied end to end, never softening a bad result', () => {
  it('an otherwise-excellent vehicle with 0 photos is capped at 69, never higher', () => {
    const result = calculateRiskScore('v1', {
      ...emptyInput,
      checklistItems: cleanChecklist,
      testDriveRatings: { accel: 1 },
      hasPremiumHistory: false,
    })
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('NOT_ASSESSED')
    expect(result.buyScore).toBeLessThanOrEqual(69)
  })

  it('HIGH_RISK from real findings/checklist problems remains HIGH_RISK regardless of photo coverage', () => {
    const badChecklist = [
      makeChecklistItem({ id: 'p1', category: 'MECHANICAL', status: 'PROBLEM' }),
      makeChecklistItem({ id: 'p2', category: 'MECHANICAL', status: 'PROBLEM' }),
      makeChecklistItem({ id: 'p3', category: 'EXTERIOR', status: 'PROBLEM' }),
    ]
    const result = calculateRiskScore('v-bad', {
      ...emptyInput,
      checklistItems: badChecklist,
      aiFindings: [
        makeAIFinding({ id: 'f1', severity: 'critical', confidence: 90 }),
        makeAIFinding({ id: 'f2', severity: 'critical', confidence: 88 }),
      ],
      photoCount: 8,
    })
    expect(['HIGH_RISK', 'WALK_AWAY']).toContain(result.verdict)
    // Zero photos would only ever cap a score DOWN — it must never appear
    // to rescue a vehicle that already earned a bad verdict from real
    // evidence.
    const zeroPhotoVariant = calculateRiskScore('v-bad-no-photos', {
      ...emptyInput,
      checklistItems: badChecklist,
      aiFindings: [],
      photoCount: 0,
    })
    expect(['HIGH_RISK', 'WALK_AWAY']).toContain(zeroPhotoVariant.verdict)
  })

  it('WALK_AWAY from severe VIN/damage history remains WALK_AWAY regardless of photo coverage', () => {
    const result = calculateRiskScore('v-walkaway', {
      ...emptyInput,
      hasPremiumHistory: true,
      vinData: {
        vin: 'WVWZZZ1JZXW000001', make: 'Volkswagen', model: 'Golf', year: 2018,
        accidentCount: 5, mileageHistory: [], damageHistory: [
          { date: '2022-01-01', description: 'severe', repairCostEstimate: 9000, currency: 'EUR' },
        ],
        ownershipHistory: [], theftStatus: 'stolen', outstandingFinance: true, totalLoss: true,
        recalls: [], riskFlags: [],
      },
      checklistItems: [
        makeChecklistItem({ id: 'p1', category: 'MECHANICAL', status: 'PROBLEM' }),
        makeChecklistItem({ id: 'p2', category: 'DOCUMENTS', status: 'PROBLEM' }),
      ],
      photoCount: 0,
    })
    expect(result.verdict).toBe('WALK_AWAY')
  })

  it('negative findings are never softened by the coverage cap — a critical finding with real photos still scores low', () => {
    const result = calculateRiskScore('v-critical', {
      ...emptyInput,
      aiFindings: [
        makeAIFinding({ id: 'f1', severity: 'critical', confidence: 92 }),
        makeAIFinding({ id: 'f2', severity: 'critical', confidence: 90 }),
        makeAIFinding({ id: 'f3', severity: 'critical', confidence: 88 }),
      ],
      photoCount: 8,
    })
    expect(result.dimensions.ai.score).toBeLessThan(60)
    expect(result.buyScore).toBeLessThan(74)
  })

  it('the "no critical AI anomalies" positive reason is suppressed when coverage is NOT_ASSESSED or LIMITED — missing evidence must not read as a clean bill of health', () => {
    const notAssessed = calculateRiskScore('v-reasons-none', { ...emptyInput, photoCount: 0 })
    expect(notAssessed.reasonsFor).not.toContain('No critical AI anomalies detected in photos')

    const limited = calculateRiskScore('v-reasons-limited', { ...emptyInput, photoCount: 1 })
    expect(limited.reasonsFor).not.toContain('No critical AI anomalies detected in photos')

    const full = calculateRiskScore('v-reasons-full', { ...emptyInput, photoCount: 8 })
    expect(full.reasonsFor).toContain('No critical AI anomalies detected in photos')
  })
})

describe('web report + PDF parity — one authoritative score/coverage source, never re-derived independently', () => {
  it('the on-screen report reads visualCoverage from riskScore.dimensions.ai.signals and reuses it for the label, capped-score notice, and recommendation text (never a separate calculation)', () => {
    const source = read('src/app/report/page.tsx')
    expect(source).toContain("riskScore?.dimensions?.ai?.signals?.visualCoverage")
    expect(source).toContain("safeReportT(t, 'report.scoreLabel.limitedEvidence'")
    expect(source).toContain("safeReportT(t, 'report.scoreCappedNotice'")
    // The recommendation text must come from the shared, coverage-aware
    // builder — not an independent verdict-only i18n lookup that could
    // disagree with it (the exact bug class this task closes).
    expect(source).toContain('buildDecisionContent(')
    expect(source).not.toContain('recommendationKey')
  })

  it('the PDF reuses the exact same i18n keys as the web report for the score label and capped-score notice', () => {
    const source = read('src/lib/report/pdf.ts')
    expect(source).toContain("t('report.scoreLabel.limitedEvidence')")
    expect(source).toContain("t('report.scoreCappedNotice')")
  })

  it('the scoring engine — the single source both surfaces read from — exports the cap functions rather than each surface deriving its own cap values', () => {
    const source = read('src/modules/scoring/scoring.logic.ts')
    expect(source).toContain('export function getVisualCoverageCap')
    expect(source).toContain('export function applyVisualCoverageCap')
    expect(source).toContain('NOT_ASSESSED: 69')
    expect(source).toContain('LIMITED: 74')
    expect(source).toContain('PARTIAL: 89')
  })

  it('historical-report reconciliation (scoring.service.ts) reuses the same exported cap/verdict functions rather than re-implementing the cap values', () => {
    const source = read('src/modules/scoring/scoring.service.ts')
    expect(source).toContain('applyVisualCoverageCap')
    expect(source).toContain('pickMoreCautiousVerdict')
    expect(source).not.toMatch(/\b69\b.*\b74\b.*\b89\b/) // cap numbers not re-declared locally
  })
})
