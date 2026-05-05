import { Prisma } from '.prisma/client'
import { prisma } from '@/config/prisma'

export type AccessStatus = 'DRAFT' | 'ACTIVE' | 'LOCKED' | 'NONE'

export interface InspectionAccessState {
  status: AccessStatus
  id: string | null
  activeReportId: string | null
  lockedReportId: string | null
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
  const active = await prisma.inspectionReport.findFirst({
    where: { userId, vehicleId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  })
  if (active) {
    return { status: 'ACTIVE', id: active.id, activeReportId: active.id, lockedReportId: null }
  }

  const latest = await prisma.inspectionReport.findFirst({
    where: { userId, vehicleId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  })
  if (!latest) return { status: 'NONE', id: null, activeReportId: null, lockedReportId: null }

  return {
    status: latest.status as AccessStatus,
    id: latest.id,
    activeReportId: null,
    lockedReportId: latest.status === 'LOCKED' ? latest.id : null,
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
}

/**
 * Atomically claims the active report row for generation. This blocks double
 * clicks from creating two scores from the same credit.
 */
export async function startReportGeneration(
  userId: string,
  vehicleId: string,
): Promise<{ ok: true; reportId: string } | { ok: false; reason: 'ACCESS_REQUIRED' | 'GENERATION_IN_PROGRESS' }> {
  let active: { id: string; startedAt: Date | null } | null = await prisma.inspectionReport.findFirst({
    where: { userId, vehicleId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, startedAt: true },
  })

  if (!active) {
    const hasAnyReport = await prisma.inspectionReport.findFirst({
      where: { userId, vehicleId },
      select: { id: true },
    })
    if (hasAnyReport) return { ok: false, reason: 'ACCESS_REQUIRED' }

    const legacy = await grantAccess(userId, vehicleId, { grantedVia: 'legacy' })
    active = { id: legacy.id, startedAt: null }
  }

  if (active.startedAt) return { ok: false, reason: 'GENERATION_IN_PROGRESS' }

  const claimed = await prisma.inspectionReport.updateMany({
    where: { id: active.id, status: 'ACTIVE', startedAt: null },
    data: { startedAt: new Date() },
  })

  if (claimed.count === 0) return { ok: false, reason: 'GENERATION_IN_PROGRESS' }
  return { ok: true, reportId: active.id }
}

export async function releaseReportGeneration(reportId: string): Promise<void> {
  await prisma.inspectionReport.updateMany({
    where: { id: reportId, status: 'ACTIVE' },
    data: { startedAt: null },
  })
}

export async function lockReport(reportId: string, riskScoreId: string): Promise<void> {
  void riskScoreId
  await prisma.inspectionReport.update({
    where: { id: reportId },
    data: { status: 'LOCKED', lockedAt: new Date() },
  })
}
