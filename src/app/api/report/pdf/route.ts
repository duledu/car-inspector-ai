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
import { generateFallbackResult } from '@/modules/research/fallback.knowledge'
import { generateRequestId, pipelineLog } from '@/lib/logger'
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
  const requestId          = generateRequestId()
  const reqStart           = Date.now()
  const payloadEstimateBytes = JSON.stringify(parsed.data).length
  pipelineLog({ step: 'pdf:start', requestId, vehicleId, userId: auth.userId, success: true, durationMs: 0, meta: { photoCount: photos.length, payloadEstimateBytes, locale } })

  try {
    // ── Step 1: vehicle ──────────────────────────────────────────────────────
    pipelineLog({ step: 'pdf:vehicle:start', requestId, vehicleId, success: true, durationMs: Date.now() - reqStart, meta: { locale } })
    const vehicleRecord = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: auth.userId },
    })
    if (!vehicleRecord) return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })

    // ── Step 2: session + AI results ─────────────────────────────────────────
    const step2Start = Date.now()
    pipelineLog({ step: 'pdf:db:start', requestId, vehicleId, success: true, durationMs: Date.now() - reqStart, meta: {} })
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
    pipelineLog({ step: 'pdf:db:complete', requestId, vehicleId, success: true, durationMs: Date.now() - step2Start, meta: { aiResults: aiResults.length, hasSession: !!session } })

    // ── Step 3: scoring ───────────────────────────────────────────────────────
    const step3Start  = Date.now()
    pipelineLog({ step: 'pdf:scoring:start', requestId, vehicleId, success: true, durationMs: Date.now() - reqStart, meta: {} })
    const cachedScore = await scoringService.getLatest(vehicleId)
    const score       = cachedScore ?? (await scoringService.computeAndPersist(vehicleId, auth.userId))
    const scoreFresh  = !cachedScore
    pipelineLog({ step: 'pdf:scoring:complete', requestId, vehicleId, durationMs: Date.now() - step3Start, success: true, meta: { scoreFresh, verdict: score.verdict, buyScore: score.buyScore } })

    // ── Step 4: research ─────────────────────────────────────────────────────
    const vehicle = toVehicleDto(vehicleRecord)
    pipelineLog({ step: 'pdf:research:start', requestId, vehicleId, success: true, durationMs: Date.now() - reqStart, meta: {} })
    const researchParams = {
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
    }
    const step4Start = Date.now()
    const research = await Promise.race([
      vehicleResearchService.research(researchParams),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('research_timeout')), 8_000)
      ),
    ]).catch((err: Error) => {
      pipelineLog({ step: 'pdf:research:fallback', requestId, vehicleId, success: false, durationMs: Date.now() - step4Start, meta: { error: err.message } })
      return generateFallbackResult({ make: vehicle.make, model: vehicle.model, year: vehicle.year, locale })
    })
    pipelineLog({ step: 'pdf:research:complete', requestId, vehicleId, durationMs: Date.now() - step4Start, success: true, meta: { dataSource: (research as any).dataSource ?? 'unknown', limitedMode: !!(research as any).limitedMode } })
    pipelineLog({
      step: 'pdf:research:summary',
      requestId,
      vehicleId,
      success: true,
      durationMs: Date.now() - step4Start,
      meta: {
        limitedMode: (research as any).limitedMode,
        sections: Object.keys(research.sections ?? {}),
        missingItems: Object.entries(research.sections ?? {})
          .filter(([, s]) => !Array.isArray((s as any)?.items))
          .map(([k]) => k),
      },
    })

    // ── Step 5: build PDF ────────────────────────────────────────────────────
    const step5Start = Date.now()
    const findings = sanitizeFindings(aiResults)
    const checklistItems = toChecklistDto(session?.checklistItems ?? [])
    pipelineLog({ step: 'pdf:build:start', requestId, vehicleId, success: true, durationMs: Date.now() - reqStart, meta: {
      vehicle: { make: vehicle.make, model: vehicle.model, year: vehicle.year, hasVin: !!vehicle.vin },
      score: {
        buyScore: score.buyScore,
        verdict: score.verdict,
        dimensions: Object.fromEntries(
          Object.entries(score.dimensions).map(([k, v]) => [k, (v as any)?.score])
        ),
        reasonsFor: score.reasonsFor?.length ?? 0,
        reasonsAgainst: score.reasonsAgainst?.length ?? 0,
        negotiationHints: score.negotiationHints?.length ?? 0,
      },
      research: {
        hasResearch: !!research,
        hasSummary: !!research?.summary,
        hasPriceContext: !!research?.priceContext,
        sectionItemCounts: Object.fromEntries(
          Object.entries(research?.sections ?? {}).map(([k, s]) => [k, Array.isArray((s as any)?.items) ? (s as any).items.length : 'MISSING'])
        ),
      },
      findings: findings.length,
      checklist: checklistItems.length,
      photos: photos.length,
    } })

    let pdf: Buffer
    try {
      pdf = await buildInspectionReportPdf({
        vehicle,
        score,
        research,
        findings,
        checklistItems,
        photos,
        generatedAt: new Date(),
        locale,
      })
    } catch (buildErr: any) {
      pipelineLog({ step: 'pdf:build:failed', requestId, vehicleId, success: false, durationMs: Date.now() - step5Start, meta: { message: buildErr?.message, name: buildErr?.name } })
      throw buildErr
    }
    const totalDurationMs = Date.now() - reqStart
    pipelineLog({ step: 'pdf:complete', requestId, vehicleId, durationMs: totalDurationMs, success: true, meta: { pdfBytes: pdf?.byteLength, buildMs: Date.now() - step5Start, timeoutRisk: totalDurationMs > 8_000 } })

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filenameFor(vehicle)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    pipelineLog({ step: 'pdf:failed', requestId, vehicleId, durationMs: Date.now() - reqStart, success: false, meta: { error: err?.message ?? 'unknown' } })
    if (err?.message === 'VEHICLE_NOT_FOUND') {
      return apiError('Vehicle not found', { status: 404, code: 'NOT_FOUND' })
    }
    logApiError('report/pdf', 'generate', err, { vehicleId })
    return apiError('Report generation failed, try again', { status: 500, code: 'INTERNAL_ERROR' })
  }
}
