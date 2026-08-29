// =============================================================================
// resolveDashboardInspectionState — Regression Tests
//
// Root cause under test: the dashboard previously trusted useInspectionStore's
// persisted `session` unconditionally. Since that session survives in
// localStorage independent of the (authoritative) server-fetched vehicle
// list, a stale session referencing a deleted or nonexistent vehicle would
// render as "Resume Your Inspection" with its old (possibly 100%) checklist
// progress — even for an account with 0 vehicles and no active inspection.
//
// This function is the single place that decides whether a persisted session
// may be treated as the current, resumable inspection. `vehicles` must be
// the freshly server-fetched list — it stands in for "database state" in
// every scenario below.
// =============================================================================

import { resolveDashboardInspectionState, type MinimalSession, type MinimalVehicle } from '../../src/lib/inspection/dashboard-state'

const vehicleA: MinimalVehicle = { id: 'vehicle-a' }
const vehicleB: MinimalVehicle = { id: 'vehicle-b' }

function sessionFor(vehicleId: string): MinimalSession {
  return { vehicleId }
}

describe('resolveDashboardInspectionState', () => {
  test('1. 0 vehicles + 0 inspections — no session, empty vehicle list', () => {
    const result = resolveDashboardInspectionState(null, 'PRE_SCREENING', [])
    expect(result).toEqual({ hasActiveSession: false, shouldClearStaleSession: false })
  })

  test('2. 0 vehicles + historical/completed inspection data — stale session for a vehicle absent from the (empty) authoritative list must be cleared, not shown as active', () => {
    const result = resolveDashboardInspectionState(sessionFor('deleted-vehicle'), 'FINAL_REPORT', [])
    expect(result.hasActiveSession).toBe(false)
    expect(result.shouldClearStaleSession).toBe(true)
  })

  test('3. vehicle exists + completed inspection — must not be presented as active/resumable, but is not flagged as stale (it is real, just terminal)', () => {
    const result = resolveDashboardInspectionState(sessionFor(vehicleA.id), 'FINAL_REPORT', [vehicleA])
    expect(result).toEqual({ hasActiveSession: false, shouldClearStaleSession: false })
  })

  test('4. vehicle exists + genuinely active partial inspection — resumable', () => {
    const result = resolveDashboardInspectionState(sessionFor(vehicleA.id), 'EXTERIOR', [vehicleA])
    expect(result).toEqual({ hasActiveSession: true, shouldClearStaleSession: false })
  })

  test('5a. active inspection reaches 100% checklist completion but has not yet finalized — still legitimately resumable (checklist % is independent of phase)', () => {
    // A user who has ticked every checklist item but not yet triggered report
    // generation is still genuinely mid-inspection; the dashboard must keep
    // showing it as active until the phase actually reaches FINAL_REPORT.
    const result = resolveDashboardInspectionState(sessionFor(vehicleA.id), 'RISK_ANALYSIS', [vehicleA])
    expect(result).toEqual({ hasActiveSession: true, shouldClearStaleSession: false })
  })

  test('5b. the moment the phase reaches FINAL_REPORT, the session stops being "active" regardless of prior 100% checklist state', () => {
    const result = resolveDashboardInspectionState(sessionFor(vehicleA.id), 'FINAL_REPORT', [vehicleA])
    expect(result.hasActiveSession).toBe(false)
  })

  test('6. vehicle associated with an old inspection is deleted — session now points at a vehicleId missing from the authoritative list', () => {
    // vehicles list now contains a different vehicle only (vehicle-a was
    // deleted; vehicle-b was added later) — the stale session must be
    // detected and cleared even though the user is not at zero vehicles.
    const result = resolveDashboardInspectionState(sessionFor(vehicleA.id), 'MECHANICAL', [vehicleB])
    expect(result).toEqual({ hasActiveSession: false, shouldClearStaleSession: true })
  })

  test('7. stale client-side inspection state exists but the server has no valid active inspection — server/vehicle list is authoritative over whatever is cached', () => {
    // Simulates: localStorage still has a fully "complete-looking" session
    // (20/20, RISK_ANALYSIS phase) from a prior account/browser state, but a
    // fresh fetchVehicles() call (server truth) returned zero vehicles.
    const result = resolveDashboardInspectionState(sessionFor('some-old-vehicle'), 'RISK_ANALYSIS', [])
    expect(result.hasActiveSession).toBe(false)
    expect(result.shouldClearStaleSession).toBe(true)
  })

  test('never flags a session as stale when there is no session at all, regardless of vehicle list', () => {
    expect(resolveDashboardInspectionState(null, 'FINAL_REPORT', [vehicleA]).shouldClearStaleSession).toBe(false)
    expect(resolveDashboardInspectionState(null, 'FINAL_REPORT', []).shouldClearStaleSession).toBe(false)
  })

  test('a session matching one of several existing vehicles is resolved correctly', () => {
    const result = resolveDashboardInspectionState(sessionFor(vehicleB.id), 'INTERIOR', [vehicleA, vehicleB])
    expect(result).toEqual({ hasActiveSession: true, shouldClearStaleSession: false })
  })
})
