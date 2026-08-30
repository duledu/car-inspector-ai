// =============================================================================
// Legacy report read-time reconciliation
//
// Reports persisted BEFORE the visualCoverage fix never stored that signal
// in their `breakdown` JSON — their AI dimension is just the old hardcoded
// score/explanation pair (e.g. score 68 + "No photo analysis data
// available..."). Without correction, re-opening one of those old reports
// would still show the exact contradiction a real tester reported: a
// numeric "Visual Inspection" score plus a STRONG_BUY / "Safe to proceed"
// verdict, sitting right next to a "no photos were analyzed" notice.
//
// This is a pure, DB-free transform (ScoringService.mapToDto has no I/O),
// so it's tested directly like scoring.logic.ts rather than through a
// mocked-Prisma integration test. It must never write anything back — the
// input `breakdown`/`buyScore`/`verdict` here stand in for what is already
// sitting in the database, untouched.
// =============================================================================

import { scoringService } from '../../src/modules/scoring/scoring.service'

// mapToDto is private; it's a pure sync transform with no I/O, so casting
// to access it directly is the simplest correct way to test it in isolation.
const mapToDto = (raw: any) => (scoringService as unknown as { mapToDto(raw: any): any }).mapToDto(raw)

function legacyRow(overrides: Partial<{ buyScore: number; verdict: string; aiScore: number; aiExplanation: string }> = {}) {
  const aiScore = overrides.aiScore ?? 68
  const aiExplanation = overrides.aiExplanation ?? 'No photo analysis data available. Upload more clear photos for a reliable AI assessment.'
  return {
    id: 'r1',
    vehicleId: 'v1',
    buyScore: overrides.buyScore ?? 85,
    riskScore: 15,
    verdict: overrides.verdict ?? 'STRONG_BUY',
    breakdown: {
      ai: { label: 'AI Photo Analysis', score: aiScore, weight: 25, explanation: aiExplanation },
      exterior: { label: 'Exterior Inspection', score: 90, weight: 20, explanation: 'ok' },
      interior: { label: 'Interior Inspection', score: 90, weight: 3, explanation: 'ok' },
      mechanical: { label: 'Mechanical Check', score: 90, weight: 20, explanation: 'ok' },
      vin: { label: 'VIN & History', score: 90, weight: 20, explanation: 'ok' },
      testDrive: { label: 'Test Drive', score: 90, weight: 10, explanation: 'ok' },
      documents: { label: 'Document Check', score: 90, weight: 2, explanation: 'ok' },
      riskFlags: [],
      negotiationHints: [],
      serviceHistoryStatus: 'FULL',
    },
    aiScore,
    exteriorScore: 90, interiorScore: 90, mechanicalScore: 90, vinScore: 90, testDriveScore: 90, documentScore: 90,
    hasPremuimData: false,
    reasonsFor: [], reasonsAgainst: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
  }
}

describe('legacy report reconciliation — the exact tester-reported contradiction', () => {
  it('a pre-fix zero-photo STRONG_BUY report is inferred as NOT_ASSESSED and its verdict is capped, without touching the stored buyScore number', () => {
    const dto = mapToDto(legacyRow())

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('NOT_ASSESSED')
    expect(dto.verdict).not.toBe('STRONG_BUY')
    // Only the verdict is corrected here — the historical numeric buyScore
    // is left as persisted; the fix targets the contradictory copy, not a
    // full DB-free score recomputation this session was not authorized to
    // design.
    expect(dto.buyScore).toBe(85)
  })

  it('a pre-fix LIMITED-coverage (1-2 photos) STRONG_BUY report is also capped', () => {
    const dto = mapToDto(legacyRow({
      aiScore: 58,
      aiExplanation: 'No issues detected in 1 of 8 analyzed photos. Very limited coverage — most of the vehicle was not inspected.',
    }))

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('LIMITED')
    expect(dto.verdict).not.toBe('STRONG_BUY')
  })

  it('a legacy report already at HIGH_RISK is left at HIGH_RISK, never "helped" by the cap', () => {
    const dto = mapToDto(legacyRow({ buyScore: 35, verdict: 'HIGH_RISK' }))
    expect(dto.verdict).toBe('HIGH_RISK')
  })

  it('a normal PARTIAL/FULL-coverage legacy report (score 92, real assessment) is left completely untouched', () => {
    const dto = mapToDto(legacyRow({
      aiScore: 92,
      aiExplanation: 'No obvious issues detected from available photos. Results are advisory only.',
    }))

    expect(dto.dimensions.ai.signals?.visualCoverage).toBeUndefined()
    expect(dto.verdict).toBe('STRONG_BUY')
    expect(dto.buyScore).toBe(85)
  })

  it('a post-fix row (verdict already capped at write time by calculateRiskScore) passes through untouched, with no re-inference or double-capping', () => {
    // Rows written after the fix already went through enforceVisualCoverageCap
    // inside calculateRiskScore before being persisted, so a NOT_ASSESSED row
    // is never actually stored as STRONG_BUY — it arrives here already
    // BUY_WITH_CAUTION. mapToDto must leave that alone, not re-derive it.
    const row = legacyRow({
      buyScore: 78,
      verdict: 'BUY_WITH_CAUTION',
      aiScore: 50,
      aiExplanation: 'No photo analysis data available. Upload photos for a visual assessment.',
    })
    row.breakdown.ai = { ...row.breakdown.ai, signals: { hasMeaningfulIssues: false, visualCoverage: 'NOT_ASSESSED' } }
    const dto = mapToDto(row)

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('NOT_ASSESSED')
    expect(dto.verdict).toBe('BUY_WITH_CAUTION')
    expect(dto.buyScore).toBe(78)
  })
})
