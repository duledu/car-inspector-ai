// =============================================================================
// Dashboard "active inspection" resolution — single source of truth
//
// The dashboard must never present a persisted (localStorage-cached)
// InspectionSession as the user's current, resumable inspection unless it
// genuinely belongs to a vehicle the server currently confirms the user owns.
// useInspectionStore persists session/checklist state indefinitely; nothing
// about that persistence layer knows when the referenced vehicle has since
// been deleted (or never existed for this account/browser at all). Without
// this check, a stale session survives in localStorage and "Resume Your
// Inspection" / checklist progress is shown for a vehicle that no longer
// exists.
//
// `vehicles` must be the freshly server-fetched list (post fetchVehicles())
// — it is the authoritative source of truth this resolves against.
// =============================================================================

export interface MinimalVehicle {
  id: string
}

export interface MinimalSession {
  vehicleId: string
}

export interface DashboardInspectionState {
  /** True only for a session that belongs to a currently-existing vehicle AND has not reached its terminal phase. Safe to render as "Resume Your Inspection" / current progress. */
  hasActiveSession: boolean
  /** True when a persisted session references a vehicle absent from the authoritative list — the caller should clear it (e.g. resetSession()) rather than display it. */
  shouldClearStaleSession: boolean
}

const TERMINAL_PHASE = 'FINAL_REPORT'

/**
 * Resolves whether a persisted inspection session should be treated as the
 * current active/resumable inspection, given the authoritative vehicle list.
 *
 * A resumable inspection must belong to an existing vehicle and not already
 * be in its terminal phase. A session referencing a vehicle that is not in
 * `vehicles` (deleted, or stale cross-account/browser localStorage) is never
 * active — flagged for the caller to clear instead.
 */
export function resolveDashboardInspectionState(
  session: MinimalSession | null,
  currentPhase: string,
  vehicles: readonly MinimalVehicle[],
): DashboardInspectionState {
  if (!session) {
    return { hasActiveSession: false, shouldClearStaleSession: false }
  }

  const vehicleExists = vehicles.some((v) => v.id === session.vehicleId)
  if (!vehicleExists) {
    return { hasActiveSession: false, shouldClearStaleSession: true }
  }

  return { hasActiveSession: currentPhase !== TERMINAL_PHASE, shouldClearStaleSession: false }
}
