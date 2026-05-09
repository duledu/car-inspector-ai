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

export function canViewInspectionReport(access: Pick<InspectionAccessState, 'status'>): boolean {
  return access.status === 'ACTIVE' || access.status === 'LOCKED'
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

    return {
      status: latest.status as AccessStatus,
      id: latest.id,
      activeReportId: latest.status === 'ACTIVE' ? latest.id : null,
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
 * Returns true if AI inspection work (photo analysis, aggregation) may run.
 * Report GENERATION is separately gated by startReportGeneration.
 * LOCKED is the only status that blocks inspection work — the credit is consumed.
 */
export async function hasActiveAccess(userId: string, vehicleId: string): Promise<boolean> {
  const { status } = await getInspectionAccess(userId, vehicleId)
  return status === 'ACTIVE' || status === 'NONE' || status === 'DRAFT'
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
      // No ACTIVE record — user must purchase or redeem a promo to generate.
      return { ok: false, reason: 'ACCESS_REQUIRED' }
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
      // Access table unavailable: fail closed so report generation cannot bypass payment.
      return { ok: false, reason: 'ACCESS_REQUIRED' }
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
    // Only unlimited promo reports stay ACTIVE after generation.
    // Legacy grants are no longer auto-renewed — they lock like any other report.
    const shouldRemainActive = report.grantedVia === 'promo' && promoMeta?.unlimited === true

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
