import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { carVerticalService } from '@/modules/integrations/carvertical/carvertical.service'
import { apiError, logApiError } from '@/utils/api-response'

export async function GET(req: NextRequest, { params }: { params: { vehicleId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    // Verify vehicle belongs to user
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: params.vehicleId, userId: auth.userId },
    })
    if (!vehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    // Verify premium access
    const grant = await prisma.accessGrant.findFirst({
      where: {
        userId: auth.userId,
        vehicleId: params.vehicleId,
        productType: 'CARVERTICAL_REPORT',
        isActive: true,
      },
    })
    if (!grant) return apiError('Premium access required', { status: 403, code: 'FORBIDDEN' })

    if (!vehicle.vin) {
      return apiError('Vehicle VIN is required for history report', { status: 400, code: 'VALIDATION_ERROR' })
    }

    const report = await carVerticalService.getReport(params.vehicleId, auth.userId)
    return NextResponse.json({ data: report })
  } catch (err: any) {
    logApiError('premium/report/[vehicleId]', 'getReport', err, { vehicleId: params.vehicleId })
    return apiError(err?.message ?? 'Failed to fetch report', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
