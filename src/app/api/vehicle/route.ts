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
  vin: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const vehicles = await prisma.vehicle.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: vehicles })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: auth.userId,
      ...parsed.data,
    },
  })

  return NextResponse.json({ data: vehicle }, { status: 201 })
}
