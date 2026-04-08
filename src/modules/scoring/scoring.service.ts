// =============================================================================
// Scoring Service
// Orchestrates: read inspection data → run logic → persist result
// =============================================================================

import { prisma } from '@/config/prisma'
import { calculateRiskScore } from './scoring.logic'
import type { ScoreCalculationInput, RiskScore, AIFinding } from '@/types'
import type { AIResult, ChecklistItem } from '.prisma/client'

export class ScoringService {
  /**
   * computeAndPersist
   * Fetches all inspection data for a vehicle, runs scoring logic, saves result.
   */
  async computeAndPersist(vehicleId: string, userId: string): Promise<RiskScore> {
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

    const aiFindings: AIFinding[] = aiResults.flatMap(
      (r: AIResult) => (r.findings as unknown as AIFinding[]) ?? []
    )

    const hasPremium = !!purchase
    const input: ScoreCalculationInput = {
      aiFindings,
      checklistItems: (session?.checklistItems ?? []).map((item: ChecklistItem) => ({
        id: item.id,
        sessionId: item.sessionId,
        category: item.category as any,
        itemKey: item.itemKey,
        itemLabel: item.itemLabel,
        status: item.status as any,
        notes: item.notes,
        photoUrl: item.photoUrl,
      })),
      vinData: hasPremium && vinHistory ? (vinHistory.normalizedData as any) : null,
      testDriveRatings: {},
      hasPremiumHistory: hasPremium,
    }

    const scoreResult = calculateRiskScore(vehicleId, input)

    // Store riskFlags, negotiationHints, and serviceHistoryStatus inside the
    // breakdown JSON field — no schema migration required.
    const breakdownJson = {
      ...scoreResult.dimensions,
      riskFlags:             scoreResult.riskFlags,
      negotiationHints:      scoreResult.negotiationHints,
      serviceHistoryStatus:  scoreResult.serviceHistoryStatus,
    }

    const saved = await prisma.riskScore.upsert({
      where: { sessionId: session?.id ?? '' },
      update: {
        buyScore:      scoreResult.buyScore,
        riskScore:     scoreResult.riskScore,
        verdict:       scoreResult.verdict,
        aiScore:       scoreResult.dimensions.ai.score,
        exteriorScore: scoreResult.dimensions.exterior.score,
        interiorScore: scoreResult.dimensions.interior.score,
        mechanicalScore: scoreResult.dimensions.mechanical.score,
        vinScore:      scoreResult.dimensions.vin.score,
        testDriveScore: scoreResult.dimensions.testDrive.score,
        documentScore: scoreResult.dimensions.documents.score,
        hasPremuimData: scoreResult.hasPremiumData,
        breakdown:     breakdownJson as any,
        reasonsFor:    scoreResult.reasonsFor,
        reasonsAgainst: scoreResult.reasonsAgainst,
      },
      create: {
        vehicleId,
        sessionId:     session?.id,
        buyScore:      scoreResult.buyScore,
        riskScore:     scoreResult.riskScore,
        verdict:       scoreResult.verdict,
        aiScore:       scoreResult.dimensions.ai.score,
        exteriorScore: scoreResult.dimensions.exterior.score,
        interiorScore: scoreResult.dimensions.interior.score,
        mechanicalScore: scoreResult.dimensions.mechanical.score,
        vinScore:      scoreResult.dimensions.vin.score,
        testDriveScore: scoreResult.dimensions.testDrive.score,
        documentScore: scoreResult.dimensions.documents.score,
        hasPremuimData: scoreResult.hasPremiumData,
        breakdown:     breakdownJson as any,
        reasonsFor:    scoreResult.reasonsFor,
        reasonsAgainst: scoreResult.reasonsAgainst,
      },
    })

    return this.mapToDto(saved)
  }

  /**
   * getLatest
   * Fetch the most recent persisted risk score for a vehicle.
   */
  async getLatest(vehicleId: string): Promise<RiskScore | null> {
    const score = await prisma.riskScore.findFirst({
      where: { vehicleId },
      orderBy: { createdAt: 'desc' },
    })
    if (!score) return null
    return this.mapToDto(score)
  }

  private mapToDto(raw: any): RiskScore {
    const breakdown = (raw.breakdown ?? {}) as any
    // Extract dimensions (everything except the extra fields we stored)
    const { riskFlags, negotiationHints, serviceHistoryStatus, ...dimensions } = breakdown
    return {
      id:          raw.id,
      vehicleId:   raw.vehicleId,
      buyScore:    raw.buyScore,
      riskScore:   raw.riskScore,
      verdict:     raw.verdict,
      dimensions,
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
