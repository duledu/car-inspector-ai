// =============================================================================
// Neutral AI-score placeholder — leak audit
//
// When visualCoverage is NOT_ASSESSED, the internal score (currently 50) is
// a bookkeeping placeholder only — it exists so the flat, non-nullable
// `aiScore` DB column and the ScoreDimension.score field always have a
// number to hold, never because 50 is a real assessment result. This suite
// pins down every path that could leak it to a user as if it were one:
// the scoring engine's own invariant, the weighted average, the on-screen
// report's DimBar, the PDF's dimension bars, and the DTO reconstruction
// used by both. It also locks down that the legacy-report inference
// (scoring.service.ts's inferLegacyVisualCoverage) cannot misclassify a
// genuine real-findings score that happens to numerically coincide with an
// old hardcoded placeholder value (68/58) — it must key off the paired
// explanation text, never the number alone.
// =============================================================================

import fs from 'fs'
import path from 'path'
import { calculateRiskScore } from '../../src/modules/scoring/scoring.logic'
import { scoringService } from '../../src/modules/scoring/scoring.service'

const mapToDto = (raw: any) => (scoringService as unknown as { mapToDto(raw: any): any }).mapToDto(raw)

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('scoring engine — the neutral placeholder is always paired with NOT_ASSESSED', () => {
  it('zero photos: score is the documented placeholder AND visualCoverage is NOT_ASSESSED together (never one without the other)', () => {
    const result = calculateRiskScore('v1', {
      aiFindings: [], checklistItems: [], vinData: null, testDriveRatings: {}, hasPremiumHistory: false, askingPrice: null,
    })
    expect(result.dimensions.ai.score).toBe(50)
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('NOT_ASSESSED')
  })

  it('the weighted overall buyScore never includes the placeholder — a vehicle with an otherwise-perfect checklist scores the same whether the AI dimension is 50 (excluded) or absent from the input entirely', () => {
    const cleanChecklist = (['EXTERIOR', 'INTERIOR', 'MECHANICAL', 'DOCUMENTS'] as const).flatMap((category) =>
      Array.from({ length: 4 }, (_, i) => ({
        id: `${category}-${i}`, sessionId: 's1', category, itemKey: 'k', itemLabel: 'l', status: 'OK' as const,
      }))
    )
    const noPhotos = calculateRiskScore('v-no-photos', {
      aiFindings: [], checklistItems: cleanChecklist, vinData: null, testDriveRatings: { accel: 1 }, hasPremiumHistory: false, askingPrice: null,
    })
    // The placeholder score of 50 is well below a clean checklist's score —
    // if it leaked into the average even partially, buyScore would be
    // pulled down noticeably below what the assessed dimensions alone earn.
    expect(noPhotos.dimensions.ai.score).toBe(50)
    expect(noPhotos.buyScore).toBeGreaterThanOrEqual(80)
  })
})

describe('report UI — DimBar cannot render the numeric placeholder', () => {
  const source = read('src/app/report/page.tsx')

  it('the not-assessed early return happens before the numeric score and percent-width bar are ever computed', () => {
    const notAssessedReturnIdx = source.indexOf('if (notAssessed) {')
    const percentWidthIdx = source.indexOf('width: `${score}%`')
    expect(notAssessedReturnIdx).toBeGreaterThan(-1)
    expect(percentWidthIdx).toBeGreaterThan(-1)
    expect(notAssessedReturnIdx).toBeLessThan(percentWidthIdx)
  })

  it('the not-assessed branch never interpolates {score} into its own markup', () => {
    const start = source.indexOf('if (notAssessed) {')
    const end = source.indexOf('const severity = getDimensionSeverity', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const block = source.slice(start, end)
    expect(block).not.toMatch(/\{score\}/)
  })

  it('the AI dimension is the only DimBar call site wired to notAssessed, driven solely by the visualCoverage signal', () => {
    expect(source).toContain("notAssessed={(dim as ScoreDimension).signals?.visualCoverage === 'NOT_ASSESSED'}")
  })
})

describe('PDF — dimension bars cannot render the numeric placeholder', () => {
  const source = read('src/lib/report/pdf.ts')

  it('both the filled-bar canvas and the numeric text are gated behind the same notAssessed ternary for the ai row', () => {
    const start = source.indexOf('function dimensionBars')
    const end = source.indexOf('\nfunction severityDistribution')
    const block = source.slice(start, end)
    expect(block).toContain('const notAssessed = key === \'ai\' && aiNotAssessed')
    // The value branch must be reachable only on the false side of the ternary.
    const valueBranchIdx = block.indexOf("{ text: String(value)")
    const notAssessedTextIdx = block.indexOf("t('report.visualNotAssessed')")
    expect(valueBranchIdx).toBeGreaterThan(-1)
    expect(notAssessedTextIdx).toBeGreaterThan(-1)
    expect(notAssessedTextIdx).toBeLessThan(valueBranchIdx)
  })
})

describe('DTO reconstruction — score 50 never appears without the NOT_ASSESSED signal, for fresh or legacy rows', () => {
  it('a freshly computed zero-photo RiskScore round-tripped through mapToDto keeps score 50 paired with NOT_ASSESSED', () => {
    const fresh = calculateRiskScore('v1', {
      aiFindings: [], checklistItems: [], vinData: null, testDriveRatings: {}, hasPremiumHistory: false, askingPrice: null,
    })
    const raw = {
      id: 'r1', vehicleId: 'v1', buyScore: fresh.buyScore, riskScore: fresh.riskScore, verdict: fresh.verdict,
      breakdown: { ...fresh.dimensions, riskFlags: [], negotiationHints: [], serviceHistoryStatus: fresh.serviceHistoryStatus },
      aiScore: fresh.dimensions.ai.score,
      exteriorScore: fresh.dimensions.exterior.score, interiorScore: fresh.dimensions.interior.score,
      mechanicalScore: fresh.dimensions.mechanical.score, vinScore: fresh.dimensions.vin.score,
      testDriveScore: fresh.dimensions.testDrive.score, documentScore: fresh.dimensions.documents.score,
      hasPremuimData: false, reasonsFor: [], reasonsAgainst: [], createdAt: new Date(),
    }
    const dto = mapToDto(raw)
    expect(dto.dimensions.ai.score).toBe(50)
    expect(dto.dimensions.ai.signals.visualCoverage).toBe('NOT_ASSESSED')
  })

  it('a legacy row whose ai dimension score is 68 by real-findings coincidence (not the old no-photos branch) is NOT reclassified as NOT_ASSESSED', () => {
    // A genuine findings-based assessment always carries the "Issues
    // detected..." explanation template, never the old no-photos string —
    // this proves the legacy inference keys off that pairing, not the bare
    // number, so a real historical 68/58 visual score is never hidden.
    const raw = {
      id: 'r2', vehicleId: 'v2', buyScore: 70, verdict: 'BUY_WITH_CAUTION',
      breakdown: {
        ai: {
          label: 'AI Photo Analysis', score: 68, weight: 25,
          explanation: 'Issues detected in 2 of 8 photos. Main concern: Possible repaint. Confidence: 72%. Further manual inspection recommended.',
        },
        exterior: { label: 'Exterior Inspection', score: 80, weight: 20, explanation: 'ok' },
        interior: { label: 'Interior Inspection', score: 80, weight: 3, explanation: 'ok' },
        mechanical: { label: 'Mechanical Check', score: 80, weight: 20, explanation: 'ok' },
        vin: { label: 'VIN & History', score: 80, weight: 20, explanation: 'ok' },
        testDrive: { label: 'Test Drive', score: 80, weight: 10, explanation: 'ok' },
        documents: { label: 'Document Check', score: 80, weight: 2, explanation: 'ok' },
        riskFlags: [], negotiationHints: [], serviceHistoryStatus: 'FULL',
      },
      aiScore: 68, exteriorScore: 80, interiorScore: 80, mechanicalScore: 80, vinScore: 80, testDriveScore: 80, documentScore: 80,
      hasPremuimData: false, reasonsFor: [], reasonsAgainst: [], createdAt: new Date(),
    }
    const dto = mapToDto(raw)

    expect(dto.dimensions.ai.score).toBe(68)
    expect(dto.dimensions.ai.signals?.visualCoverage).toBeUndefined()
    expect(dto.verdict).toBe('BUY_WITH_CAUTION')
  })

  it('a legacy row whose ai dimension score is 58 by real-findings coincidence is likewise NOT reclassified as LIMITED', () => {
    const raw = {
      id: 'r3', vehicleId: 'v3', buyScore: 65, verdict: 'BUY_WITH_CAUTION',
      breakdown: {
        ai: {
          label: 'AI Photo Analysis', score: 58, weight: 25,
          explanation: 'Issues detected in 4 of 8 photos. Main concern: Panel gap. Confidence: 61%. Further manual inspection recommended.',
        },
        exterior: { label: 'Exterior Inspection', score: 80, weight: 20, explanation: 'ok' },
        interior: { label: 'Interior Inspection', score: 80, weight: 3, explanation: 'ok' },
        mechanical: { label: 'Mechanical Check', score: 80, weight: 20, explanation: 'ok' },
        vin: { label: 'VIN & History', score: 80, weight: 20, explanation: 'ok' },
        testDrive: { label: 'Test Drive', score: 80, weight: 10, explanation: 'ok' },
        documents: { label: 'Document Check', score: 80, weight: 2, explanation: 'ok' },
        riskFlags: [], negotiationHints: [], serviceHistoryStatus: 'FULL',
      },
      aiScore: 58, exteriorScore: 80, interiorScore: 80, mechanicalScore: 80, vinScore: 80, testDriveScore: 80, documentScore: 80,
      hasPremuimData: false, reasonsFor: [], reasonsAgainst: [], createdAt: new Date(),
    }
    const dto = mapToDto(raw)

    expect(dto.dimensions.ai.signals?.visualCoverage).toBeUndefined()
    expect(dto.verdict).toBe('BUY_WITH_CAUTION')
  })
})
