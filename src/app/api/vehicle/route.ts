import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const CreateSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().finite().int().min(1900).max(new Date().getFullYear() + 2),
  mileage: z.number().finite().int().positive().optional(),
  askingPrice: z.number().finite().positive().optional(),
  currency: z.string().default('EUR'),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'INDEPENDENT_DEALER']).default('PRIVATE'),
  engineCc: z.number().finite().int().positive().max(10000).optional(),
  powerKw: z.number().finite().int().positive().max(2000).optional(),
  fuelType: z.enum(['diesel', 'petrol', 'hybrid', 'electric', 'lpg']).optional(),
  transmission: z.enum(['manual', 'automatic', 'dct', 'cvt']).optional(),
  bodyType: z.enum(['sedan', 'wagon', 'hatchback', 'suv', 'coupe', 'van']).optional(),
  vin: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: vehicles })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    logApiError('vehicle', 'findMany', err)
    return apiError(`Failed to fetch vehicles: ${message}`, { status: 500, code: 'INTERNAL_ERROR' })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON body', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 400, code: 'VALIDATION_ERROR', details: parsed.error.flatten() })
  }

  try {
    const vehicle = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.create({
        data: { userId: auth.userId, ...parsed.data },
      })
      await tx.inspectionReport.create({
        data: { userId: auth.userId, vehicleId: v.id },
      })
      return v
    })
    return NextResponse.json({ data: vehicle }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    logApiError('vehicle', 'create', err)
    return apiError(`Failed to save vehicle: ${message}`, { status: 500, code: 'INTERNAL_ERROR' })
  }
}
