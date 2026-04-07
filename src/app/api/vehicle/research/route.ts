// =============================================================================
// Vehicle Research API Route — POST /api/vehicle/research
// Uses VehicleResearchService: AI first → knowledge base fallback.
// Always returns useful content — never a dead error state.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { vehicleResearchService } from '@/modules/research/research.service'

const schema = z.object({
  make:   z.string().min(1).max(60),
  model:  z.string().min(1).max(80),
  year:   z.number().int().min(1980).max(new Date().getFullYear() + 1),
  engine: z.string().max(100).optional(),
  trim:   z.string().max(80).optional(),
})

export async function POST(req: NextRequest) {
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

  const { make, model, year, engine, trim } = parsed.data

  // research() never throws — it always returns useful content
  const result = await vehicleResearchService.research({ make, model, year, engine, trim })

  return NextResponse.json({
    data:        result,
    limitedMode: result.limitedMode,
  })
}
