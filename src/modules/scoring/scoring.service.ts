// =============================================================================
// Scoring Service
// Orchestrates: read inspection data → run logic → persist result
// =============================================================================

import { prisma } from '@/config/prisma'
import { getInspectionCompletion, normalizeChecklistItems } from '@/lib/inspection/checklist'
import { generateRequestId, pipelineLog } from '@/lib/logger'
import { calculateRiskScore, clampScore, AI_TOTAL_EXPECTED_PHOTOS } from './scoring.logic'
import type { ScoreCalculationInput, RiskScore, AIFinding } from '@/types'
import type { AIResult, ChecklistItem } from '.prisma/client'

function sanitizeDimension(raw: any, label: string, weight: number, fallbackScore: number) {
  if (!raw || typeof raw !== 'object') {
    return {
      label,
      score: fallbackScore,
      weight,
      explanation: 'Score details unavailable.',
    }
  }
  return {
    ...raw,
    label: typeof raw.label === 'string' ? raw.label : label,
    score: clampScore(raw.score, 0, 100, fallbackScore),
    weight: clampScore(raw.weight, 0, 100, weight),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : 'Score details unavailable.',
  }
}

export class ScoringService {
  /**
   * computeAndPersist
   * Fetches all inspection data for a vehicle, runs scoring logic, saves result.
   */
  async computeAndPersist(vehicleId: string, userId: string): Promise<RiskScore> {
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId },
      select: { id: true, askingPrice: true },
    })
    if (!vehicle) {
      throw new Error('VEHICLE_NOT_FOUND')
    }

    const dbFetchStart = Date.now()
    const [session, aiResults, vinHistory, purchase] = await Promise.all([
      prisma.inspectionSession.findFirst({
        where: { vehicleId, userId },
        include: { checklistItems: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.aIResult.findMany({
        where: { vehicleId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vINHistory.findUnique({ where: { vehicleId } }),
      prisma.premiumPurchase.findFirst({
        where: { vehicleId, userId, status: 'PAID', productType: 'CARVERTICAL_REPORT' },
      }),
    ])
    const dbFetchMs = Date.now() - dbFetchStart

    const aiFindings: AIFinding[] = aiResults.flatMap((r: AIResult) => {
      const findings = r.findings as unknown
      if (!Array.isArray(findings)) {
        pipelineLog({
          step: 'score:invalid-ai-findings',
          requestId: generateRequestId(),
          vehicleId,
          success: false,
          durationMs: Date.now() - dbFetchStart,
          meta: { aiResultId: r.id },
        })
        return []
      }
      return findings as AIFinding[]
    })
    const actionableIssuePhotos = aiResults.filter((result: AIResult) => {
      const findings = Array.isArray(result.findings) ? (result.findings as unknown as AIFinding[]) : []
      return findings.some((finding) => {
        const confidence = Number(finding.confidence)
        return finding.severity !== 'info' && Number.isFinite(confidence) && confidence >= 45
      })
    }).length

    const normalizedChecklist = normalizeChecklistItems((session?.checklistItems ?? []).map((item: ChecklistItem) => ({
      id: item.id,
      sessionId: item.sessionId,
      category: item.category as any,
      itemKey: item.itemKey,
      itemLabel: item.itemLabel,
      status: item.status as any,
      notes: item.notes,
      photoUrl: item.photoUrl,
    })))

    const completion = getInspectionCompletion(normalizedChecklist)
    if (!completion.isComplete) {
      const error = new Error('INSPECTION_INCOMPLETE')
      ;(error as Error & { details?: unknown }).details = completion
      throw error
    }

    const hasPremium = !!purchase
    const testDriveRatings = normalizedChecklist
      .filter((item) => item.category === 'TEST_DRIVE' && item.status !== 'PENDING')
      .reduce<Record<string, number>>((acc, item) => {
        acc[item.itemKey] =
          item.status === 'OK' ? 1 :
          item.status === 'WARNING' ? 2 :
          3
        return acc
      }, {})

    const input: ScoreCalculationInput = {
      aiFindings,
      photoCount: aiResults.length || null,
      issuePhotoCount: actionableIssuePhotos || null,
      totalExpectedPhotos: AI_TOTAL_EXPECTED_PHOTOS,
      checklistItems: normalizedChecklist,
      vinData: hasPremium && vinHistory ? (vinHistory.normalizedData as any) : null,
      testDriveRatings,
      hasPremiumHistory: hasPremium,
      askingPrice: vehicle.askingPrice,
    }

    const computeStart = Date.now()
    const scoreResult = calculateRiskScore(vehicleId, input)
    const computeMs = Date.now() - computeStart

    // Store riskFlags, negotiationHints, and serviceHistoryStatus inside the
    // breakdown JSON field — no schema migration required.
    const breakdownJson = {
      ...scoreResult.dimensions,
      riskFlags:             scoreResult.riskFlags,
      negotiationHints:      scoreResult.negotiationHints,
      serviceHistoryStatus:  scoreResult.serviceHistoryStatus,
    }

    const scoreData = {
      buyScore:      clampScore(scoreResult.buyScore, 10, 96, 50),
      riskScore:     clampScore(scoreResult.riskScore, 4, 90, 50),
      verdict:       scoreResult.verdict,
      aiScore:       clampScore(scoreResult.dimensions.ai.score, 0, 100, 50),
      exteriorScore: clampScore(scoreResult.dimensions.exterior.score, 0, 100, 70),
      interiorScore: clampScore(scoreResult.dimensions.interior.score, 0, 100, 70),
      mechanicalScore: clampScore(scoreResult.dimensions.mechanical.score, 0, 100, 70),
      vinScore:      clampScore(scoreResult.dimensions.vin.score, 0, 100, 65),
      testDriveScore: clampScore(scoreResult.dimensions.testDrive.score, 0, 100, 72),
      documentScore: clampScore(scoreResult.dimensions.documents.score, 0, 100, 70),
      hasPremuimData: scoreResult.hasPremiumData,
      breakdown:     breakdownJson as any,
      reasonsFor:    scoreResult.reasonsFor,
      reasonsAgainst: scoreResult.reasonsAgainst,
    }

    const dbPersistStart = Date.now()
    let saved
    if (session?.id) {
      saved = await prisma.riskScore.upsert({
        where: { sessionId: session.id },
        update: scoreData,
        create: {
          vehicle: { connect: { id: vehicleId } },
          session: { connect: { id: session.id } },
          ...scoreData,
        },
      })
    } else {
      const existing = await prisma.riskScore.findFirst({
        where: { vehicleId, sessionId: null },
        orderBy: { createdAt: 'desc' },
      })

      saved = existing
        ? await prisma.riskScore.update({ where: { id: existing.id }, data: scoreData })
        : await prisma.riskScore.create({
            data: {
              vehicle: { connect: { id: vehicleId } },
              ...scoreData,
            },
          })
    }
    const dbPersistMs = Date.now() - dbPersistStart

    pipelineLog({
      step: 'score:sub-timings',
      requestId: generateRequestId(),
      vehicleId,
      success: true,
      durationMs: dbFetchMs + computeMs + dbPersistMs,
      meta: { dbFetchMs, computeMs, dbPersistMs, verdict: scoreResult.verdict, buyScore: scoreData.buyScore },
    })

    return this.mapToDto(saved)
  }

  /**
   * getLatest
   * Fetch the most recent persisted risk score for a vehicle.
   * Returns null when the checklist was modified after the score was calculated
   * (i.e., the score is stale), forcing the caller to recalculate.
   */
  async getLatest(vehicleId: string): Promise<RiskScore | null> {
    const session = await prisma.inspectionSession.findFirst({
      where: { vehicleId },
      include: { checklistItems: true },
      orderBy: { createdAt: 'desc' },
    })
    const completion = getInspectionCompletion((session?.checklistItems ?? []).map((item: ChecklistItem) => ({
      id: item.id,
      sessionId: item.sessionId,
      category: item.category as any,
      itemKey: item.itemKey,
      itemLabel: item.itemLabel,
      status: item.status as any,
      notes: item.notes,
      photoUrl: item.photoUrl,
    })))
    if (!completion.isComplete) return null

    const score = await prisma.riskScore.findFirst({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    })
    if (!score) return null

    // Staleness check: if any checklist item was updated after the score was
    // last calculated, the score no longer reflects the current answers.
    // Return null so the caller is forced to recalculate rather than showing
    // stale results silently.
    const latestChecklistChange = (session?.checklistItems ?? []).reduce<Date | null>(
      (max, item) => (!max || item.updatedAt > max ? item.updatedAt : max),
      null
    )
    if (latestChecklistChange && latestChecklistChange > score.updatedAt) {
      return null
    }

    return this.mapToDto(score)
  }

  private mapToDto(raw: any): RiskScore {
    const breakdown = (raw.breakdown ?? {}) as any
    // Extract dimensions (everything except the extra fields we stored)
    const { riskFlags, negotiationHints, serviceHistoryStatus, ...dimensions } = breakdown
    const safeDimensions = {
      ...dimensions,
      ai: sanitizeDimension(dimensions.ai, 'AI Photo Analysis', 25, raw.aiScore ?? 50),
      exterior: sanitizeDimension(dimensions.exterior, 'Exterior Inspection', 20, raw.exteriorScore ?? 70),
      interior: sanitizeDimension(dimensions.interior, 'Interior Inspection', 3, raw.interiorScore ?? 70),
      mechanical: sanitizeDimension(dimensions.mechanical, 'Mechanical Check', 20, raw.mechanicalScore ?? 70),
      vin: sanitizeDimension(dimensions.vin, 'VIN & History', 20, raw.vinScore ?? 65),
      testDrive: sanitizeDimension(dimensions.testDrive, 'Test Drive', 10, raw.testDriveScore ?? 72),
      documents: sanitizeDimension(dimensions.documents, 'Document Check', 2, raw.documentScore ?? 70),
    }
    return {
      id:          raw.id,
      vehicleId:   raw.vehicleId,
      buyScore:    clampScore(raw.buyScore, 10, 96, 50),
      riskScore:   clampScore(raw.riskScore, 4, 90, 50),
      verdict:     raw.verdict,
      dimensions: safeDimensions,
      hasPremiumData:       raw.hasPremuimData,
      reasonsFor:           raw.reasonsFor  ?? [],
      reasonsAgainst:       raw.reasonsAgainst ?? [],
      riskFlags:            riskFlags            ?? [],
      negotiationHints:     negotiationHints     ?? [],
      serviceHistoryStatus: serviceHistoryStatus ?? 'PARTIAL',
      createdAt:   raw.createdAt.toISOString(),
    }
  }
}

export const scoringService = new ScoringService()
