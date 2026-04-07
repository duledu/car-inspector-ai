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
  powerKw:  z.number().int().positive().max(2000).optional(),
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

  // Decode engine spec from notes for vehicles created before the DB migration.
  const decoded = vehicles.map(v => {
    const match = v.notes?.match(/\[engine:(\d*)cc\/(\d*)kw\]/)
    if (!match) return { ...v, engineCc: null, powerKw: null }
    return {
      ...v,
      engineCc: match[1] ? Number.parseInt(match[1]) : null,
      powerKw:  match[2] ? Number.parseInt(match[2]) : null,
    }
  })

  return NextResponse.json({ data: decoded })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return NextResponse.json({ message: auth.reason }, { status: 401 })

  const body = await req.json()
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  // Destructure fields that don't have DB columns yet (engineCc / powerKw).
  // They are encoded into the notes field so they survive the round-trip until
  // the DB migration adds the real columns (run: prisma migrate dev).
  const { engineCc, powerKw, notes, ...coreData } = parsed.data

  // Encode engine spec into notes when provided, preserving any user notes.
  const engineTag = engineCc || powerKw
    ? `[engine:${engineCc ?? ''}cc/${powerKw ?? ''}kw]`
    : ''
  const mergedNotes = [notes, engineTag].filter(Boolean).join(' ') || undefined

  const vehicle = await prisma.vehicle.create({
    data: {
      userId: auth.userId,
      ...coreData,
      notes: mergedNotes,
    },
  })

  // Re-attach parsed engine fields to the response so the frontend store
  // receives the complete vehicle object (they're already in the returned notes too).
  return NextResponse.json({
    data: { ...vehicle, engineCc: engineCc ?? null, powerKw: powerKw ?? null },
  }, { status: 201 })
}
