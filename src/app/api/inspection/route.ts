// =============================================================================
// Inspection Score API Route — POST /api/inspection/score
// Triggers score calculation for the authenticated user's vehicle.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { scoringService } from '@/modules/scoring'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { isDatabaseUnavailableError } from '@/config/prisma'
import { env } from '@/config/env'
import { lockReport, releaseReportGeneration, startReportGeneration, verifyVehicleOwnership } from '@/lib/inspection/access'

const schema = z.object({ vehicleId: z.string().min(1) })

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return apiError('vehicleId is required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const vehicleId = parsed.data.vehicleId
    const ownsVehicle = await verifyVehicleOwnership(authResult.userId, vehicleId)
    if (!ownsVehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    let reportId: string | undefined
    if (env.features.inspectionAccessGate) {
      const claim = await startReportGeneration(authResult.userId, vehicleId)
      if (!claim.ok) {
        return apiError('Report is locked or access required', {
          status: 403,
          code: claim.reason === 'GENERATION_IN_PROGRESS' ? 'GENERATION_IN_PROGRESS' : 'ACCESS_REQUIRED',
        })
      }
      reportId = claim.reportId
    }

    try {
      const score = await scoringService.computeAndPersist(vehicleId, authResult.userId, { inspectionReportId: reportId })
      if (env.features.inspectionAccessGate && reportId) await lockReport(reportId, score.id)
      return NextResponse.json({ data: score })
    } catch (err) {
      if (env.features.inspectionAccessGate && reportId) await releaseReportGeneration(reportId).catch(() => undefined)
      throw err
    }
  } catch (err: any) {
    if (isDatabaseUnavailableError(err)) {
      return apiError('Database unavailable', { status: 503, code: 'DATABASE_UNAVAILABLE' })
    }
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    if (err?.message === 'INSPECTION_INCOMPLETE') {
      return apiError('Inspection is incomplete', {
        status: 409,
        code: 'INSPECTION_INCOMPLETE',
        details: (err as { details?: unknown })?.details,
      })
    }
    logApiError('inspection', 'computeAndPersist', err, { vehicleId: parsed.data.vehicleId })
    return apiError('Score calculation failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req)
  if (!authResult.success) {
    return apiError('Unauthorized', { status: 401, code: 'UNAUTHORIZED' })
  }

  const vehicleId = req.nextUrl.searchParams.get('vehicleId')
  if (!vehicleId) {
    return apiError('vehicleId query param required', { status: 422, code: 'VALIDATION_ERROR' })
  }

  try {
    const ownsVehicle = await verifyVehicleOwnership(authResult.userId, vehicleId)
    if (!ownsVehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    const score = await scoringService.getLatest(vehicleId)
    return NextResponse.json({ data: score })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return apiError('Database unavailable', { status: 503, code: 'DATABASE_UNAVAILABLE' })
    }
    logApiError('inspection', 'getLatest', err, { vehicleId })
    return apiError('Failed to fetch score', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
