import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { scoringService } from '@/modules/scoring'
import { vehicleResearchService } from '@/modules/research/research.service'
import { normalizeChecklistItems } from '@/lib/inspection/checklist'
import { buildInspectionReportPdf } from '@/lib/report/pdf'
import { normalizePdfLocale } from '@/lib/report/i18n'
import { requireAuth } from '@/utils/auth.middleware'
import { apiError, logApiError } from '@/utils/api-response'
import type { AIFinding, ChecklistItem, Vehicle } from '@/types'

export const runtime = 'nodejs'

const PhotoDraftSchema = z.object({
  key: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  thumbUrl: z.string().startsWith('data:image/').max(220_000),
})

const BodySchema = z.object({
  vehicleId: z.string().min(1),
  locale: z.string().min(2).max(10).optional().default('en'),
  photos: z.array(PhotoDraftSchema).max(8).optional().default([]),
})

function toVehicleDto(vehicle: NonNullable<Awaited<ReturnType<typeof prisma.vehicle.findFirst>>>): Vehicle {
  return {
    ...vehicle,
    sellerType: vehicle.sellerType as Vehicle['sellerType'],
    status: vehicle.status as Vehicle['status'],
    fuelType: vehicle.fuelType as Vehicle['fuelType'],
    transmission: vehicle.transmission as Vehicle['transmission'],
    bodyType: vehicle.bodyType as Vehicle['bodyType'],
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  }
}

function toChecklistDto(items: Array<{
  id: string
  sessionId: string
  category: string
  itemKey: string
  itemLabel: string
  status: string
  notes: string | null
  photoUrl: string | null
}>): ChecklistItem[] {
  return normalizeChecklistItems(items.map(item => ({
    id: item.id,
    sessionId: item.sessionId,
    category: item.category as ChecklistItem['category'],
    itemKey: item.itemKey,
    itemLabel: item.itemLabel,
    status: item.status as ChecklistItem['status'],
    notes: item.notes,
    photoUrl: item.photoUrl,
  })))
}

function sanitizeFindings(results: Array<{ findings: unknown }>): AIFinding[] {
  return results.flatMap(result => {
    if (!Array.isArray(result.findings)) return []
    return result.findings.filter((finding): finding is AIFinding => {
      if (!finding || typeof finding !== 'object') return false
      const raw = finding as Partial<AIFinding>
      return (
        typeof raw.title === 'string' &&
        typeof raw.description === 'string' &&
        typeof raw.area === 'string' &&
        typeof raw.confidence === 'number' &&
        (raw.severity === 'critical' || raw.severity === 'warning' || raw.severity === 'info')
      )
    })
  })
}

function filenameFor(vehicle: Vehicle): string {
  const base = [
    'Used-Cars-Doctor-AI',
    vehicle.year,
    vehicle.make,
    vehicle.model,
    'Inspection-Report',
  ].filter(Boolean).join('-')
  return `${base.replace(/[^a-z0-9-]+/gi, '-').replace(/-+/g, '-')}.pdf`
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) return apiError(auth.reason, { status: 401, code: 'UNAUTHORIZED' })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Invalid report request', {
      status: 422,
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten().fieldErrors,
    })
  }

  const { vehicleId, photos } = parsed.data
  const locale = normalizePdfLocale(parsed.data.locale)

  try {
    const vehicleRecord = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: auth.userId },
    })
    if (!vehicleRecord) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    const [session, aiResults] = await Promise.all([
      prisma.inspectionSession.findFirst({
        where: { vehicleId, userId: auth.userId },
        include: { checklistItems: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aIResult.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

    const score =
      (await scoringService.getLatest(vehicleId)) ??
      (await scoringService.computeAndPersist(vehicleId, auth.userId))

    const vehicle = toVehicleDto(vehicleRecord)
    const research = await vehicleResearchService.research({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      engineCc: vehicle.engineCc ?? undefined,
      powerKw: vehicle.powerKw ?? undefined,
      askingPrice: vehicle.askingPrice ?? undefined,
      currency: vehicle.currency,
      fuelType: vehicle.fuelType ?? undefined,
      transmission: vehicle.transmission ?? undefined,
      bodyType: vehicle.bodyType ?? undefined,
      mileage: vehicle.mileage ?? undefined,
      locale,
    })

    const pdf = await buildInspectionReportPdf({
      vehicle,
      score,
      research,
      findings: sanitizeFindings(aiResults),
      checklistItems: toChecklistDto(session?.checklistItems ?? []),
      photos,
      generatedAt: new Date(),
      locale,
    })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameFor(vehicle)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    logApiError('report/pdf', 'generate', err, { vehicleId })
    return apiError('Report generation failed, try again', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
