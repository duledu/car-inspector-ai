import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { carVerticalService } from '@/modules/integrations/carvertical/carvertical.service'

export async function GET(req: NextRequest, { params }: { params: { vehicleId: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  // Verify vehicle belongs to user
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: params.vehicleId, userId: auth.userId },
  })
  if (!vehicle) return NextResponse.json({ message: 'Vehicle not found' }, { status: 404 })

  // Verify premium access
  const grant = await prisma.accessGrant.findFirst({
    where: {
      userId: auth.userId,
      vehicleId: params.vehicleId,
      productType: 'CARVERTICAL_REPORT',
      isActive: true,
    },
  })
  if (!grant) return NextResponse.json({ message: 'Premium access required' }, { status: 403 })

  if (!vehicle.vin) {
    return NextResponse.json({ message: 'Vehicle VIN is required for history report' }, { status: 400 })
  }

  try {
    const report = await carVerticalService.getReport(params.vehicleId, auth.userId)
    return NextResponse.json({ data: report })
  } catch (err: any) {
    return NextResponse.json({ message: err?.message ?? 'Failed to fetch report' }, { status: 500 })
  }
}
