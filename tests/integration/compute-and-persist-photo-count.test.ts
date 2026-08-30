// =============================================================================
// computeAndPersist — the REAL photo-count pipeline, through the actual
// persistence/scoring boundary that hid the bug
//
// AIResult is one AGGREGATE row per analysis run (see
// ai-analysis/analyze/route.ts's own docstring: "A full inspection
// aggregates once"). Before the ai-result-payload.ts fix, `photoCount` fed
// into the scoring engine was `aiResults.length` — the number of AGGREGATE
// ROWS (almost always 0 or 1), not the number of photos actually analyzed.
// That meant a genuine 8-clean-photo inspection (1 row, 0 findings, since
// clean photos produce no finding entries) would compute
// getVisualCoverage(1, 8) = LIMITED and cap the final score at 74 — even
// though every photo was actually assessed.
//
// These tests exercise scoringService.computeAndPersist end to end against
// a mocked Prisma client, constructing the AIResult row exactly as
// /api/ai-analysis/analyze now persists it (via buildAIResultPayload),
// proving the fix through the real boundary rather than only at the
// isolated ScoreCalculationInput level.
// =============================================================================

jest.mock('@/lib/inspection/checklist', () => ({
  normalizeChecklistItems: (items: unknown[]) => items,
  getInspectionCompletion: () => ({ isComplete: true, answeredCount: 1, totalCount: 1, missingCategories: [], categoryProgress: {} }),
}))

jest.mock('@/config/prisma', () => ({
  prisma: {
    vehicle: { findFirst: jest.fn() },
    inspectionSession: { findFirst: jest.fn() },
    aIResult: { findMany: jest.fn() },
    vINHistory: { findUnique: jest.fn() },
    premiumPurchase: { findFirst: jest.fn() },
    riskScore: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
  isMissingTableOrColumnError: () => false,
}))

import { scoringService } from '../../src/modules/scoring/scoring.service'
import { prisma as mockPrisma } from '@/config/prisma'
import { buildAIResultPayload } from '../../src/lib/inspection/ai-result-payload'

const p = mockPrisma as unknown as {
  vehicle: { findFirst: jest.Mock }
  inspectionSession: { findFirst: jest.Mock }
  aIResult: { findMany: jest.Mock }
  vINHistory: { findUnique: jest.Mock }
  premiumPurchase: { findFirst: jest.Mock }
  riskScore: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock }
}

function cleanChecklistItems() {
  return (['EXTERIOR', 'INTERIOR', 'MECHANICAL', 'DOCUMENTS'] as const).flatMap((category) =>
    Array.from({ length: 4 }, (_, i) => ({
      id: `${category}-${i}`, sessionId: 's1', category, itemKey: `k${i}`, itemLabel: 'l', status: 'OK' as const,
    }))
  )
}

/** One aggregate AIResult row, exactly as /api/ai-analysis/analyze persists it. */
function aggregateRow(usableCount: number, analyzedCount: number, findings: unknown[] = []) {
  return {
    id: 'ai-1',
    vehicleId: 'v1',
    findings: buildAIResultPayload(findings as any, analyzedCount, usableCount, analyzedCount - usableCount),
    createdAt: new Date(),
  }
}

/** A pre-fix legacy row: bare findings array, no count metadata persisted. */
function legacyRow(findings: unknown[] = []) {
  return { id: 'ai-legacy', vehicleId: 'v1', findings, createdAt: new Date() }
}

beforeEach(() => {
  jest.clearAllMocks()
  p.vehicle.findFirst.mockResolvedValue({ id: 'v1', askingPrice: null })
  p.inspectionSession.findFirst.mockResolvedValue({ id: 's1', checklistItems: cleanChecklistItems() })
  p.vINHistory.findUnique.mockResolvedValue(null)
  p.premiumPurchase.findFirst.mockResolvedValue(null)
  p.riskScore.findFirst.mockResolvedValue(null)
  p.riskScore.create.mockImplementation(async ({ data }: any) => ({ id: 'rs-1', vehicleId: 'v1', createdAt: new Date(), ...data }))
})

describe('computeAndPersist — the exact required matrix, through the real persistence boundary', () => {
  test('8 genuinely valid photos, represented by ONE aggregate AIResult row -> FULL coverage, no cap (the case that would have been silently broken)', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(8, 8)])
    const result = await scoringService.computeAndPersist('v1', 'u1')

    expect(result.dimensions.ai.signals?.visualCoverage).toBe('FULL')
    // Well above the LIMITED cap (74) proves this wasn't misclassified as
    // "1 of 8" the way the aiResults.length bug would have produced — FULL
    // coverage is genuinely reachable through this real persistence path.
    expect(result.buyScore).toBeGreaterThan(74)
  })

  test('7 valid photos (one aggregate row) -> PARTIAL, capped at 89', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(7, 7)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('PARTIAL')
    expect(result.buyScore).toBeLessThanOrEqual(89)
  })

  test('3 valid photos -> PARTIAL, capped at 89', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(3, 3)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('PARTIAL')
    expect(result.buyScore).toBeLessThanOrEqual(89)
  })

  test('2 valid photos -> LIMITED, capped at 74', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(2, 2)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('LIMITED')
    expect(result.buyScore).toBeLessThanOrEqual(74)
  })

  test('1 valid photo -> LIMITED, capped at 74', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(1, 1)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('LIMITED')
    expect(result.buyScore).toBeLessThanOrEqual(74)
  })

  test('0 valid photos -> NOT_ASSESSED, capped at 69', async () => {
    p.aIResult.findMany.mockResolvedValue([])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('NOT_ASSESSED')
    expect(result.buyScore).toBeLessThanOrEqual(69)
  })

  test('8 photo attempts, only 2 actually valid -> LIMITED, not FULL (failed/unusable attempts do not advance the tier)', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(2, 8)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('LIMITED')
    expect(result.buyScore).toBeLessThanOrEqual(74)
  })

  test('8 photo attempts, 3 valid -> PARTIAL', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(3, 8)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('PARTIAL')
    expect(result.buyScore).toBeLessThanOrEqual(89)
  })

  test('8 submitted, 3 usable, 5 unusable -> PARTIAL, cap 89 — the findings COUNT does not determine coverage, the persisted usableCount does', async () => {
    // Zero findings even though 5 photos were unusable: unusable photos
    // never produce finding entries either (only USABLE+flagged photos do)
    // — this proves coverage tier comes from usableCount, not from
    // findings.length or unusableCount.
    p.aIResult.findMany.mockResolvedValue([aggregateRow(3, 8, [])])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('PARTIAL')
    expect(result.buyScore).toBeLessThanOrEqual(89)
  })

  test('8 submitted, 2 usable, 6 unusable -> LIMITED, cap 74', async () => {
    p.aIResult.findMany.mockResolvedValue([aggregateRow(2, 8, [])])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('LIMITED')
    expect(result.buyScore).toBeLessThanOrEqual(74)
  })

  test('8 valid photos, 0 findings (the exact case that previously failed): the aggregate row persists usableCount=8, items=[], and scoring resolves FULL with no cap', async () => {
    const row = aggregateRow(8, 8, [])
    expect(row.findings).toEqual(expect.objectContaining({ items: [], usableCount: 8, analyzedCount: 8, unusableCount: 0 }))

    p.aIResult.findMany.mockResolvedValue([row])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('FULL')
    expect(result.dimensions.ai.score).toBeGreaterThanOrEqual(90) // the FULL/clean-photos band, not capped
  })

  test('retry: a newer full 8-photo run supersedes an older 2-photo run — never summed', async () => {
    p.aIResult.findMany.mockResolvedValue([
      aggregateRow(8, 8), // most recent (rows are queried orderBy createdAt desc)
      aggregateRow(2, 8), // stale first attempt
    ])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('FULL')
    // If rows were summed (8 + 2 = 10) this would still read FULL by
    // accident — cross-check against a genuinely-summed-looking but wrong
    // LIMITED-first-ordering case below to prove it's ordering, not luck.
  })

  test('retry: a newer 2-valid-photo run supersedes an older full 8-photo run — the newest row wins even when it reports LESS coverage than the stale one', async () => {
    p.aIResult.findMany.mockResolvedValue([
      aggregateRow(2, 8), // most recent — user retried with a worse/partial batch
      aggregateRow(8, 8), // stale — an earlier, better run
    ])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    // Proves this is genuinely "newest row wins" (createdAt desc ordering),
    // not "best/largest row wins" or "rows summed" — a stale full-coverage
    // row must never inflate the current, superseded state.
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('LIMITED')
    expect(result.buyScore).toBeLessThanOrEqual(74)
  })

  test('a legacy row (bare findings array, no persisted usableCount) with zero findings falls back to NOT_ASSESSED — conservative, never fabricates a photo count the data cannot support', async () => {
    p.aIResult.findMany.mockResolvedValue([legacyRow([])])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    // This is the honest, conservative answer for data that cannot prove
    // otherwise — it must NOT be LIMITED (a false claim of "1 of 8") and it
    // must never be FULL/uncapped for data with no real evidence behind it.
    expect(result.dimensions.ai.signals?.visualCoverage).toBe('NOT_ASSESSED')
    expect(result.buyScore).toBeLessThanOrEqual(69)
  })

  test('a legacy row with real findings is not misclassified as NOT_ASSESSED — findings prove at least that many photos were assessed', async () => {
    const findings = [
      { id: 'f1', area: 'a', title: 'Paint mismatch', description: 'd', severity: 'warning', confidence: 70 },
    ]
    p.aIResult.findMany.mockResolvedValue([legacyRow(findings)])
    const result = await scoringService.computeAndPersist('v1', 'u1')
    expect(result.dimensions.ai.signals?.visualCoverage).not.toBe('NOT_ASSESSED')
  })
})
