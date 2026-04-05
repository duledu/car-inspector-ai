import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const UpdateSchema = z.object({
  make: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  year: z.number().int().optional(),
  mileage: z.number().int().positive().optional(),
  askingPrice: z.number().positive().optional(),
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
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const vehicle = await getVehicleForUser(params.id, auth.userId)
  if (!vehicle) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: vehicle })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const vehicle = await getVehicleForUser(params.id, auth.userId)
  if (!vehicle) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.vehicle.update({
    where: { id: params.id },
    data: parsed.data,
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const vehicle = await getVehicleForUser(params.id, auth.userId)
  if (!vehicle) return NextResponse.json({ message: 'Not found' }, { status: 404 })

  await prisma.vehicle.delete({ where: { id: params.id } })
  return new NextResponse(null, { status: 204 })
}
