// =============================================================================
// AI Analysis — POST /api/ai-analysis/analyze
// Receives per-photo AI results, aggregates them into an AIResult record,
// persists to DB so the scoring service can read findings.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/config/prisma'
import { requireAuth } from '@/utils/auth.middleware'

const photoResultSchema = z.object({
  angle:    z.string().min(1),
  label:    z.string().min(1),
  signal:   z.string().min(1),
  severity: z.enum(['ok', 'warn', 'flag']),
  detail:   z.string(),
})

const bodySchema = z.object({
  vehicleId:    z.string().min(1),
  photoResults: z.array(photoResultSchema).min(1),
})

function mapSeverity(s: 'ok' | 'warn' | 'flag'): 'critical' | 'warning' | 'info' {
  if (s === 'flag') return 'critical'
  if (s === 'warn') return 'warning'
  return 'info'
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth.success) {
    return NextResponse.json({ message: auth.reason }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed' }, { status: 422 })
  }

  const { vehicleId, photoResults } = parsed.data

  // Convert per-photo results → AIFinding[] (skip "ok" ones to reduce noise)
  const findings = photoResults
    .filter(r => r.severity !== 'ok')
    .map((r, i) => ({
      id:          `${r.angle}-${i}`,
      area:        r.label,
      title:       r.signal,
      description: r.detail,
      severity:    mapSeverity(r.severity),
    }))

  // Score: start at 100, deduct per finding (critical = 20pts, warning = 8pts)
  const critical = findings.filter(f => f.severity === 'critical').length
  const warnings = findings.filter(f => f.severity === 'warning').length
  const overallScore = Math.max(0, 100 - critical * 20 - warnings * 8)

  try {
    const result = await prisma.aIResult.create({
      data: {
        vehicleId,
        analysisType: 'PAINT_ANALYSIS',
        findings:     findings as object[],
        overallScore,
        modelVersion: 'gpt-4o-v1',
      },
    })

    console.log(`[ai-analysis/analyze] saved ${findings.length} findings for vehicle ${vehicleId}`)

    return NextResponse.json({
      data: {
        id:           result.id,
        vehicleId:    result.vehicleId,
        findings,
        overallScore: result.overallScore,
        modelVersion: result.modelVersion,
        createdAt:    result.createdAt.toISOString(),
      },
    })
  } catch (err: any) {
    console.error('[ai-analysis/analyze] DB error:', err)
    return NextResponse.json({ message: 'Failed to save analysis' }, { status: 500 })
  }
}
