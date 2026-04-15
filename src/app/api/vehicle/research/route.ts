// =============================================================================
// Vehicle Research API Route — POST /api/vehicle/research
// Uses VehicleResearchService: AI first → knowledge base fallback.
// Always returns useful content — never a dead error state.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { vehicleResearchService } from '@/modules/research/research.service'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'

const schema = z.object({
  make:         z.string().min(1).max(60),
  model:        z.string().min(1).max(80),
  year:         z.number().finite().int().min(1980).max(new Date().getFullYear() + 1),
  engineCc:     z.number().finite().int().positive().max(10000).optional(),
  powerKw:      z.number().finite().int().positive().max(2000).optional(),
  engine:       z.string().max(100).optional(),
  trim:         z.string().max(80).optional(),
  askingPrice:  z.number().finite().positive().optional(),
  currency:     z.string().max(10).optional(),
  fuelType:     z.enum(['diesel', 'petrol', 'hybrid', 'electric', 'lpg']).optional(),
  transmission: z.string().trim().min(1).max(40).optional(),
  drivetrain:   z.string().trim().min(1).max(40).optional(),
  bodyType:     z.enum(['sedan', 'wagon', 'hatchback', 'suv', 'coupe', 'van']).optional(),
  mileage:      z.number().finite().int().positive().optional(),
  locale:       z.string().min(2).max(10).optional().default('en'),
})

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return apiError('Invalid JSON body', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors })
  }

  const { make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency, fuelType, transmission, drivetrain, bodyType, mileage, locale } = parsed.data

  // research() never throws — it always returns useful content
  try {
    const result = await vehicleResearchService.research({
      make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency,
      fuelType, transmission, drivetrain, bodyType, mileage, locale,
    })

    return NextResponse.json({
      data:        result,
      limitedMode: result.limitedMode,
    })
  } catch (err) {
    logApiError('vehicle/research', 'research', err)
    return apiError('Vehicle research failed', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
