import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getProductPrice, formatProductPrice } from '@/modules/payments/pricing'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError } from '@/utils/api-response'
import { prisma } from '@/config/prisma'

const querySchema = z.object({
  productType: z.enum(['CARVERTICAL_REPORT', 'AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE', 'INSPECTION_REPORT']),
  locale: z.string().min(2).max(10).optional(),
})

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })
  }

  const parsed = querySchema.safeParse({
    productType: req.nextUrl.searchParams.get('productType'),
    locale: req.nextUrl.searchParams.get('locale') ?? undefined,
  })
  if (!parsed.success) {
    return apiError('Validation failed', { status: 422, code: 'VALIDATION_ERROR' })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { preferredLanguage: true },
  })
  const locale = parsed.data.locale ?? user?.preferredLanguage ?? 'en'
  const price = getProductPrice(parsed.data.productType, locale)

  return NextResponse.json({
    data: {
      ...price,
      formatted: formatProductPrice(price, locale),
      locale,
    },
  })
}
