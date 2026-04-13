import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const UpdateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().finite().int().optional(),
  mileage: z.number().finite().int().positive().optional(),
  askingPrice: z.number().finite().positive().optional(),
  currency: z.string().optional(),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'INDEPENDENT_DEALER']).optional(),
  vin: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['ACTIVE', 'PURCHASED', 'PASSED', 'ARCHIVED']).optional(),
})

async function getVehicleForUser(id: string, userId: string) {
  return prisma.vehicle.findFirst({ where: { id, userId } })
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const vehicle = await getVehicleForUser(params.id, auth.userId)
    if (!vehicle) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    return NextResponse.json({ data: vehicle })
  } catch (err) {
    logApiError('vehicle/[id]', 'getVehicle', err, { vehicleId: params.id })
    return apiError('Failed to fetch vehicle', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const vehicle = await getVehicleForUser(params.id, auth.userId)
    if (!vehicle) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON body', { status: 400, code: 'BAD_REQUEST' })
    }
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('Validation failed', { status: 400, code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
    }

    const updated = await prisma.vehicle.update({
      where: { id: params.id },
      data: parsed.data,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    logApiError('vehicle/[id]', 'updateVehicle', err, { vehicleId: params.id })
    return apiError('Failed to update vehicle', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const vehicle = await getVehicleForUser(params.id, auth.userId)
    if (!vehicle) return apiError('Not found', { status: 404, code: 'NOT_FOUND' })

    await prisma.vehicle.delete({ where: { id: params.id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    logApiError('vehicle/[id]', 'deleteVehicle', err, { vehicleId: params.id })
    return apiError('Failed to delete vehicle', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
