// =============================================================================
// Legacy report read-time reconciliation
//
// Two generations of historical rows need reconciling at read time, never
// by mutating the database:
//   1. Rows from BEFORE the visualCoverage fix — no signal in `breakdown`
//      at all, inferred from the old hardcoded score/explanation pair.
//   2. Rows from AFTER the visualCoverage fix but BEFORE the evidence/
//      coverage score-cap fix — the signal is correct and the verdict was
//      already capped, but buyScore itself was never capped (e.g. a
//      genuine "88/100, Buy with Caution, 0 photos" — the exact
//      contradiction this cap fix closes).
// Both must end up rendering the same as a report generated today.
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
  it('a pre-fix zero-photo STRONG_BUY report is inferred as NOT_ASSESSED, its score capped to the coverage ceiling, and its verdict corrected — never displaying 85/STRONG_BUY again', () => {
    const dto = mapToDto(legacyRow())

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('NOT_ASSESSED')
    expect(dto.verdict).not.toBe('STRONG_BUY')
    // The evidence/coverage ceiling (see applyVisualCoverageCap) is also
    // reconciled at read time — an old 88/STRONG_BUY zero-photo report must
    // never keep showing a number the ceiling would no longer allow.
    expect(dto.buyScore).toBe(69)
  })

  it('a pre-fix LIMITED-coverage (1-2 photos) STRONG_BUY report has its score capped to 74 and its verdict corrected', () => {
    const dto = mapToDto(legacyRow({
      aiScore: 58,
      aiExplanation: 'No issues detected in 1 of 8 analyzed photos. Very limited coverage — most of the vehicle was not inspected.',
    }))

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('LIMITED')
    expect(dto.verdict).not.toBe('STRONG_BUY')
    expect(dto.buyScore).toBe(74)
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

  it('a row persisted between the visualCoverage fix and the score-cap fix (correct signal, verdict already capped, but score never capped) has its score reconciled too — not just legacy-inferred rows', () => {
    // Rows written after the visualCoverage/verdict fix but before this
    // score-cap fix went through enforceVisualCoverageCap at write time, so
    // the verdict was already correct (BUY_WITH_CAUTION, never STRONG_BUY) —
    // but buyScore itself (88) was never capped, since that feature didn't
    // exist yet. This is exactly the "88/100, Buy with Caution" contradiction
    // this task closes: the cap must apply here too, not only to fully
    // legacy (signal-missing) rows.
    const row = legacyRow({
      buyScore: 88,
      verdict: 'BUY_WITH_CAUTION',
      aiScore: 50,
      aiExplanation: 'No photo analysis data available. Upload photos for a visual assessment.',
    })
    row.breakdown.ai = { ...row.breakdown.ai, signals: { hasMeaningfulIssues: false, visualCoverage: 'NOT_ASSESSED' } }
    const dto = mapToDto(row)

    expect(dto.dimensions.ai.signals.visualCoverage).toBe('NOT_ASSESSED')
    expect(dto.verdict).toBe('BUY_WITH_CAUTION')
    expect(dto.buyScore).toBe(69)
  })

  it('a row already at or below its coverage cap is left completely unchanged — no double-capping, no accidental score drift', () => {
    const row = legacyRow({
      buyScore: 65,
      verdict: 'BUY_WITH_CAUTION',
      aiScore: 50,
      aiExplanation: 'No photo analysis data available. Upload photos for a visual assessment.',
    })
    row.breakdown.ai = { ...row.breakdown.ai, signals: { hasMeaningfulIssues: false, visualCoverage: 'NOT_ASSESSED' } }
    const dto = mapToDto(row)

    expect(dto.buyScore).toBe(65)
    expect(dto.verdict).toBe('BUY_WITH_CAUTION')
  })

  it('a fully FULL-coverage row is never capped, regardless of how it was persisted', () => {
    const row = legacyRow({ buyScore: 95, verdict: 'STRONG_BUY', aiScore: 92, aiExplanation: 'clean' })
    row.breakdown.ai = { ...row.breakdown.ai, signals: { visualCoverage: 'FULL' } }
    const dto = mapToDto(row)

    expect(dto.buyScore).toBe(95)
    expect(dto.verdict).toBe('STRONG_BUY')
  })
})
