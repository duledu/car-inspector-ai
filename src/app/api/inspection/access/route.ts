import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import { getInspectionAccess, grantAccess, verifyVehicleOwnership } from '@/lib/inspection/access'
import { getPromoMeta } from '@/lib/inspection/promo-codes'

const PromoSchema = z.object({
  vehicleId: z.string().min(1),
  code: z.string().min(1).max(32),
})

// GET /api/inspection/access?vehicleId=xxx
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  const vehicleId = req.nextUrl.searchParams.get('vehicleId')
  if (!vehicleId) return apiError('vehicleId is required', { status: 400, code: 'BAD_REQUEST' })

  try {
    const ownsVehicle = await verifyVehicleOwnership(auth.userId, vehicleId)
    if (!ownsVehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    const { status } = await getInspectionAccess(auth.userId, vehicleId)
    return NextResponse.json({ data: { status } })
  } catch (err) {
    logApiError('inspection/access', 'getAccess', err, { vehicleId })
    return apiError('Failed to fetch access status', { status: 500, code: 'INTERNAL_ERROR' })
  }
}

// POST /api/inspection/access — redeem promo code
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  let body: unknown
  try { body = await req.json() } catch {
    return apiError('Invalid JSON', { status: 400, code: 'BAD_REQUEST' })
  }

  const parsed = PromoSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('vehicleId and code are required', { status: 400, code: 'VALIDATION_ERROR' })
  }

  const { vehicleId, code } = parsed.data
  const meta = getPromoMeta(code)
  if (!meta) {
    return apiError('Invalid promo code', { status: 400, code: 'INVALID_PROMO_CODE' })
  }

  try {
    const ownsVehicle = await verifyVehicleOwnership(auth.userId, vehicleId)
    if (!ownsVehicle) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    const result = await grantAccess(auth.userId, vehicleId, {
      grantedVia: meta.grantedVia,
      promoCode: code.toUpperCase(),
    })
    return NextResponse.json({ data: { status: result.status } })
  } catch (err) {
    logApiError('inspection/access', 'grantAccess', err, { vehicleId })
    return apiError('Failed to apply promo code', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
