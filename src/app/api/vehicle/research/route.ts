// =============================================================================
// Vehicle Research API Route — POST /api/vehicle/research
// Uses VehicleResearchService: AI first → knowledge base fallback.
// Always returns useful content — never a dead error state.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { vehicleResearchService } from '@/modules/research/research.service'
import { requireAuth } from '@/utils/auth.middleware'

const schema = z.object({
  make:         z.string().min(1).max(60),
  model:        z.string().min(1).max(80),
  year:         z.number().int().min(1980).max(new Date().getFullYear() + 1),
  engineCc:     z.number().int().positive().max(10000).optional(),
  powerKw:      z.number().int().positive().max(2000).optional(),
  engine:       z.string().max(100).optional(),
  trim:         z.string().max(80).optional(),
  askingPrice:  z.number().positive().optional(),
  currency:     z.string().max(10).optional(),
  fuelType:     z.enum(['diesel', 'petrol', 'hybrid', 'electric', 'lpg']).optional(),
  transmission: z.enum(['manual', 'automatic']).optional(),
  bodyType:     z.enum(['sedan', 'wagon', 'hatchback', 'suv', 'coupe', 'van']).optional(),
  mileage:      z.number().int().positive().optional(),
  locale:       z.string().min(2).max(10).optional().default('en'),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return NextResponse.json({ message: auth.reason, code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body', code: 'BAD_REQUEST' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    )
  }

  const { make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency, fuelType, transmission, bodyType, mileage, locale } = parsed.data

  // research() never throws — it always returns useful content
  const result = await vehicleResearchService.research({
    make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency,
    fuelType, transmission, bodyType, mileage, locale,
  })

  return NextResponse.json({
    data:        result,
    limitedMode: result.limitedMode,
  })
}
