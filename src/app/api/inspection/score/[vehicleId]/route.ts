import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { isDatabaseUnavailableError } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { scoringService } from '@/modules/scoring'
import { apiError, logApiError } from '@/utils/api-response'
import { canViewInspectionReport, getInspectionAccess } from '@/lib/inspection/access'

export async function GET(req: NextRequest, { params }: { params: { vehicleId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  // Verify vehicle belongs to user
  try {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.vehicleId, userId: auth.userId },
    })
    if (!vehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    const access = await getInspectionAccess(auth.userId, params.vehicleId)
    if (!canViewInspectionReport(access)) {
      return apiError('Report access required', { status: 403, code: 'ACCESS_REQUIRED' })
    }

    const score = await scoringService.getLatest(params.vehicleId, auth.userId)
    return NextResponse.json({ data: score })
  } catch (err) {
    if (isDatabaseUnavailableError(err)) {
      return apiError('Database unavailable', { status: 503, code: 'DATABASE_UNAVAILABLE' })
    }
    logApiError('inspection/score/[vehicleId]', 'getLatest', err, { vehicleId: params.vehicleId })
    return apiError('Failed to fetch score', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
