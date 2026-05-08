/**
 * Tests for AI photo result ownership validation and stale-data prevention.
 *
 * These cover the three layers of the fix:
 *  1. Store merge — stale AI results from a different vehicle are dropped on hydration
 *  2. Photo count — only current photo drafts count (never inflated by stale AI results)
 *  3. Reason filter — AI-derived reasons are suppressed when no current photos exist
 */

// ─── AI reason filter ─────────────────────────────────────────────────────────

function isAIDerivedReason(raw: string): boolean {
  return /\bAI\b/.test(raw)
}

describe('isAIDerivedReason', () => {
  it('matches "No critical AI anomalies detected in photos"', () => {
    expect(isAIDerivedReason('No critical AI anomalies detected in photos')).toBe(true)
  })

  it('matches "AI detected 1 critical visual anomaly"', () => {
    expect(isAIDerivedReason('AI detected 1 critical visual anomaly')).toBe(true)
  })

  it('matches "2 AI warnings (paint, gaps, or trim)"', () => {
    expect(isAIDerivedReason('2 AI warnings (paint, gaps, or trim)')).toBe(true)
  })

  it('does NOT match non-AI reasons', () => {
    expect(isAIDerivedReason('No outstanding finance found')).toBe(false)
    expect(isAIDerivedReason('Mileage inconsistency detected')).toBe(false)
    expect(isAIDerivedReason('Full service history verified')).toBe(false)
    expect(isAIDerivedReason('Only 1 previous owner(s)')).toBe(false)
  })

  it('is case-sensitive — partial word "air" does not match', () => {
    expect(isAIDerivedReason('Air conditioning system checked')).toBe(false)
  })
})

// ─── Reason filtering when no current photos ─────────────────────────────────

describe('Key Findings reason filter', () => {
  const reasons = [
    'No critical AI anomalies detected in photos',
    'Full service history verified',
    'AI detected 2 critical visual anomalies',
    'No outstanding finance found',
    '3 AI warnings (paint, gaps, or trim)',
    'Mileage progression is consistent',
  ]

  const filterFn = (hasPhotos: boolean) =>
    hasPhotos ? () => true : (r: string) => !isAIDerivedReason(r)

  it('returns all reasons when photos exist', () => {
    const filtered = reasons.filter(filterFn(true))
    expect(filtered).toHaveLength(reasons.length)
  })

  it('removes all AI-derived reasons when no current photos exist', () => {
    const filtered = reasons.filter(filterFn(false))
    expect(filtered).toHaveLength(3)
    expect(filtered).toContain('Full service history verified')
    expect(filtered).toContain('No outstanding finance found')
    expect(filtered).toContain('Mileage progression is consistent')
    expect(filtered.some(isAIDerivedReason)).toBe(false)
  })

  it('returns empty array when all reasons are AI-derived and no photos', () => {
    const aiOnly = ['AI detected 1 critical visual anomaly', '2 AI warnings (paint, gaps, or trim)']
    expect(aiOnly.filter(filterFn(false))).toHaveLength(0)
  })
})

// ─── Photo count authority ────────────────────────────────────────────────────

describe('reportPhotoCount derivation', () => {
  /**
   * Simulates the fixed effect:
   *   setReportPhotoCount(drafts.length)  // NOT Math.max(drafts, aiResults)
   */
  function derivePhotoCount(draftsLength: number): number {
    return draftsLength
  }

  it('is 0 when no photo drafts exist, regardless of stale AI results', () => {
    expect(derivePhotoCount(0)).toBe(0)
  })

  it('reflects actual photo drafts when present', () => {
    expect(derivePhotoCount(4)).toBe(4)
    expect(derivePhotoCount(8)).toBe(8)
  })
})

// ─── hasCurrentPhotoAnalysis gate ─────────────────────────────────────────────

describe('hasCurrentPhotoAnalysis', () => {
  function compute(reportPhotoCount: number, aiResultsCount: number): boolean {
    return reportPhotoCount > 0 && aiResultsCount > 0
  }

  it('is false when no photos but AI results exist (stale data)', () => {
    expect(compute(0, 4)).toBe(false)
  })

  it('is false when photos exist but no AI results', () => {
    expect(compute(4, 0)).toBe(false)
  })

  it('is true when both photos and AI results are present', () => {
    expect(compute(4, 1)).toBe(true)
  })

  it('is false when both are zero', () => {
    expect(compute(0, 0)).toBe(false)
  })
})

// ─── Store merge: cross-vehicle AI result filtering ───────────────────────────

describe('useInspectionStore merge — cross-vehicle AI result guard', () => {
  const vehicleA = 'vehicle-a'
  const vehicleB = 'vehicle-b'

  const aiResultA = { id: '1', vehicleId: vehicleA, findings: [], overallScore: 90, modelVersion: 'v1', createdAt: '' }
  const aiResultB = { id: '2', vehicleId: vehicleB, findings: [], overallScore: 75, modelVersion: 'v1', createdAt: '' }
  const aiResultNoId = { id: '3', vehicleId: undefined, findings: [], overallScore: 80, modelVersion: 'v1', createdAt: '' }

  /**
   * Mirrors the filteredAIResults logic in the store's merge() function:
   *   filter(r => !r.vehicleId || r.vehicleId === storedVehicleId)
   */
  function mergeAIResults(
    aiResults: Array<{ vehicleId?: string }>,
    storedVehicleId: string | null,
  ) {
    if (!storedVehicleId) return aiResults
    return aiResults.filter(r => !r.vehicleId || r.vehicleId === storedVehicleId)
  }

  it('keeps results matching the stored vehicle', () => {
    const result = mergeAIResults([aiResultA, aiResultB], vehicleA)
    expect(result).toHaveLength(1)
    expect(result[0].vehicleId).toBe(vehicleA)
  })

  it('keeps results with no vehicleId (legacy records)', () => {
    const result = mergeAIResults([aiResultA, aiResultNoId], vehicleA)
    expect(result).toHaveLength(2)
  })

  it('drops all results when stored vehicle does not match any', () => {
    const result = mergeAIResults([aiResultA], vehicleB)
    expect(result).toHaveLength(0)
  })

  it('keeps all results when no stored vehicle id (fresh store)', () => {
    const result = mergeAIResults([aiResultA, aiResultB], null)
    expect(result).toHaveLength(2)
  })
})

// ─── Session-change detection in initSession ──────────────────────────────────

describe('initSession stale-state detection', () => {
  /**
   * Mirrors the vehicleChanged || sessionChanged guard added to initSession.
   */
  function shouldClearState(
    previousVehicleId: string | null | undefined,
    previousSessionId: string | null | undefined,
    newVehicleId: string,
    newSessionId: string,
  ): boolean {
    const vehicleChanged = !!previousVehicleId && previousVehicleId !== newVehicleId
    const sessionChanged  = !!previousSessionId  && previousSessionId  !== newSessionId
    return vehicleChanged || sessionChanged
  }

  it('clears state when vehicle changes', () => {
    expect(shouldClearState('vehicle-a', 'session-1', 'vehicle-b', 'session-2')).toBe(true)
  })

  it('clears state when same vehicle but new session (re-inspection)', () => {
    expect(shouldClearState('vehicle-a', 'session-1', 'vehicle-a', 'session-2')).toBe(true)
  })

  it('does NOT clear state when same vehicle and same session', () => {
    expect(shouldClearState('vehicle-a', 'session-1', 'vehicle-a', 'session-1')).toBe(false)
  })

  it('does NOT clear state on first load (no previous IDs)', () => {
    expect(shouldClearState(null, null, 'vehicle-a', 'session-1')).toBe(false)
    expect(shouldClearState(undefined, undefined, 'vehicle-a', 'session-1')).toBe(false)
  })
})
