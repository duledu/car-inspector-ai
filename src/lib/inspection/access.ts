import { Prisma } from '.prisma/client'
import { prisma, isMissingTableOrColumnError } from '@/config/prisma'
import { getPromoMeta } from '@/lib/inspection/promo-codes'

export type AccessStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE'

export interface InspectionAccessState {
  status: AccessStatus
  id: string | null
  activeReportId: string | null
  lockedReportId: string | null
  /** How access was granted: 'legacy' | 'promo' | 'purchase' | 'gate' | null */
  grantedVia: string | null
}

const LEGACY_NONE: InspectionAccessState = {
  status: 'NONE',
  id: null,
  activeReportId: null,
  lockedReportId: null,
  grantedVia: null,
}

function mapPrismaUniqueError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

export async function verifyVehicleOwnership(userId: string, vehicleId: string): Promise<boolean> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, userId },
    select: { id: true },
  })
  return !!vehicle
}

export async function getInspectionAccess(
  userId: string,
  vehicleId: string,
): Promise<InspectionAccessState> {
  try {
    const active = await prisma.inspectionReport.findFirst({
      where: { userId, vehicleId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, grantedVia: true },
    })
    if (active) {
      return { status: 'ACTIVE', id: active.id, activeReportId: active.id, lockedReportId: null, grantedVia: active.grantedVia }
    }

    const latest = await prisma.inspectionReport.findFirst({
      where: { userId, vehicleId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, grantedVia: true },
    })
    if (!latest) return LEGACY_NONE

    // Legacy DRAFT: grantedVia IS NULL means the vehicle route created this row
    // before the gate was intentionally enabled. Surface as ACTIVE so old users
    // are never shown the access gate.
    if (latest.status === 'DRAFT' && !latest.grantedVia) {
      return { status: 'ACTIVE', id: latest.id, activeReportId: latest.id, lockedReportId: null, grantedVia: 'legacy' }
    }

    return {
      status: latest.status as AccessStatus,
      id: latest.id,
      activeReportId: null,
      lockedReportId: latest.status === 'LOCKED' ? latest.id : null,
      grantedVia: latest.grantedVia,
    }
  } catch (err) {
    // Table not yet created (migration pending / rolled back) — treat as legacy
    if (isMissingTableOrColumnError(err)) return LEGACY_NONE
    throw err
  }
}

/**
 * Returns true if paid AI work may run for this vehicle.
 * NONE is retained as legacy compatibility for records created before gating.
 */
export async function hasActiveAccess(userId: string, vehicleId: string): Promise<boolean> {
  const { status } = await getInspectionAccess(userId, vehicleId)
  return status === 'ACTIVE' || status === 'NONE'
}

export async function canRecalculate(userId: string, vehicleId: string): Promise<boolean> {
  return hasActiveAccess(userId, vehicleId)
}

/**
 * Grants one report credit/session. It is idempotent while an ACTIVE report exists,
 * but creates a new ACTIVE row after the previous report has been LOCKED.
 */
export async function grantAccess(
  userId: string,
  vehicleId: string,
  opts: { grantedVia: string; promoCode?: string; purchaseId?: string },
): Promise<{ id: string; status: string }> {
  try {
    const existingActive = await prisma.inspectionReport.findFirst({
      where: { userId, vehicleId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    })
    if (existingActive) return existingActive

    try {
      return await prisma.inspectionReport.create({
        data: {
          userId,
          vehicleId,
          status: 'ACTIVE',
          grantedVia: opts.grantedVia,
          promoCode: opts.promoCode ?? null,
          purchaseId: opts.purchaseId ?? null,
        },
        select: { id: true, status: true },
      })
    } catch (err) {
      if (!mapPrismaUniqueError(err)) throw err
      const active = await prisma.inspectionReport.findFirstOrThrow({
        where: { userId, vehicleId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true },
      })
      return active
    }
  } catch (err) {
    if (isMissingTableOrColumnError(err)) {
      // Table missing — return a sentinel that the caller treats as granted
      return { id: 'legacy-noop', status: 'ACTIVE' }
    }
    throw err
  }
}

/**
 * Atomically claims the active report row for generation. This blocks double
 * clicks from creating two scores from the same credit.
 *
 * When the inspection_reports table does not yet exist (migration pending) the
 * function returns a legacy-grant so that existing vehicles are never blocked.
 */
export async function startReportGeneration(
  userId: string,
  vehicleId: string,
): Promise<{ ok: true; reportId: string | undefined } | { ok: false; reason: 'ACCESS_REQUIRED' | 'GENERATION_IN_PROGRESS' }> {
  try {
    let active: { id: string; startedAt: Date | null } | null = await prisma.inspectionReport.findFirst({
      where: { userId, vehicleId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, startedAt: true },
    })

    if (!active) {
      const anyReport = await prisma.inspectionReport.findFirst({
        where: { userId, vehicleId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, grantedVia: true },
      })

      if (!anyReport) {
        // No record at all → pre-gate vehicle → auto-grant legacy ACTIVE
        const legacy = await grantAccess(userId, vehicleId, { grantedVia: 'legacy' })
        if (legacy.id === 'legacy-noop') return { ok: true, reportId: undefined }
        active = { id: legacy.id, startedAt: null }
      } else if (anyReport.status === 'DRAFT' && !anyReport.grantedVia) {
        // Legacy DRAFT: auto-created by the vehicle route before the access gate
        // was intentionally enabled (grantedVia is null = not gate-controlled).
        // Upgrade it to ACTIVE in-place so the user is never incorrectly blocked.
        // The backfill migration handles this in bulk; this is the runtime safety net
        // for vehicles created in the window before the migration runs.
        const upgraded = await prisma.inspectionReport.update({
          where: { id: anyReport.id },
          data: { status: 'ACTIVE', grantedVia: 'legacy' },
          select: { id: true },
        })
        active = { id: upgraded.id, startedAt: null }
      } else if (anyReport.status === 'LOCKED') {
        // Credit was consumed for this vehicle → user needs a new credit
        return { ok: false, reason: 'ACCESS_REQUIRED' }
      } else {
        // DRAFT with explicit grantedVia, or any other non-ACTIVE status:
        // the gate intentionally requires a credit for this vehicle
        return { ok: false, reason: 'ACCESS_REQUIRED' }
      }
    }

    if (active.startedAt) return { ok: false, reason: 'GENERATION_IN_PROGRESS' }

    const claimed = await prisma.inspectionReport.updateMany({
      where: { id: active.id, status: 'ACTIVE', startedAt: null },
      data: { startedAt: new Date() },
    })

    if (claimed.count === 0) return { ok: false, reason: 'GENERATION_IN_PROGRESS' }
    return { ok: true, reportId: active.id }
  } catch (err) {
    if (isMissingTableOrColumnError(err)) {
      // Migration not yet applied — treat all vehicles as legacy (no locking)
      return { ok: true, reportId: undefined }
    }
    throw err
  }
}

export async function releaseReportGeneration(reportId: string): Promise<void> {
  if (!reportId || reportId === 'legacy-noop') return
  try {
    await prisma.inspectionReport.updateMany({
      where: { id: reportId, status: 'ACTIVE' },
      data: { startedAt: null },
    })
  } catch (err) {
    if (isMissingTableOrColumnError(err)) return
    throw err
  }
}

export async function lockReport(reportId: string, _riskScoreId: string): Promise<void> {
  if (!reportId || reportId === 'legacy-noop') return
  try {
    const report = await prisma.inspectionReport.findUnique({
      where: { id: reportId },
      select: { grantedVia: true, promoCode: true },
    })
    if (!report) return

    const promoMeta = report.promoCode ? getPromoMeta(report.promoCode) : null
    const shouldRemainActive =
      report.grantedVia === 'legacy' ||
      (report.grantedVia === 'promo' && promoMeta?.unlimited === true)

    if (shouldRemainActive) {
      await prisma.inspectionReport.update({
        where: { id: reportId },
        data: { status: 'ACTIVE', startedAt: null, lockedAt: null },
      })
      return
    }

    await prisma.inspectionReport.update({
      where: { id: reportId },
      data: { status: 'LOCKED', startedAt: null, lockedAt: new Date() },
    })
  } catch (err) {
    if (isMissingTableOrColumnError(err)) return
    throw err
  }
}
