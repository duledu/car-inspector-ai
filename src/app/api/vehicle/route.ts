import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const CreateSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 2),
  mileage: z.number().int().positive().optional(),
  askingPrice: z.number().positive().optional(),
  currency: z.string().default('EUR'),
  sellerType: z.enum(['PRIVATE', 'DEALER', 'INDEPENDENT_DEALER']).default('PRIVATE'),
  engineCc: z.number().int().positive().max(10000).optional(),
  powerKw: z.number().int().positive().max(2000).optional(),
  fuelType: z.enum(['diesel', 'petrol', 'hybrid', 'electric', 'lpg']).optional(),
  transmission: z.enum(['manual', 'automatic']).optional(),
  bodyType: z.enum(['sedan', 'wagon', 'hatchback', 'suv', 'coupe', 'van']).optional(),
  vin: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ data: vehicles })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    console.error('[GET /api/vehicle] DB error:', message)
    return NextResponse.json({ message: `Failed to fetch vehicles: ${message}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        userId: auth.userId,
        ...parsed.data,
      },
    })
    return NextResponse.json({ data: vehicle }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Database error'
    console.error('[POST /api/vehicle] DB error:', message)
    return NextResponse.json({ message: `Failed to save vehicle: ${message}` }, { status: 500 })
  }
}
