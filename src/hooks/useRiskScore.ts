// =============================================================================
// useRiskScore Hook
// Derives the current risk score from store state.
// Can either use a cached server score or compute live from local state.
// =============================================================================

import { useMemo } from 'react'
import { useInspectionStore, useVehicleStore, usePaymentStore } from '@/store'
import { calculateRiskScore, getVerdictLabel, getScoreColor } from '@/modules/scoring'
import type { RiskScore, ScoreCalculationInput } from '@/types'

interface UseRiskScoreReturn {
  score: Omit<RiskScore, 'id' | 'createdAt'> | null
  buyScore: number
  riskScore: number
  verdictLabel: string
  verdictEmoji: string
  verdictColor: string
  scoreColor: string
  hasPremium: boolean
}

export function useRiskScore(): UseRiskScoreReturn {
  const { activeVehicle } = useVehicleStore()
  const { session, checklistItems, aiResults, testDriveRatings } = useInspectionStore()
  const { hasAccess } = usePaymentStore()

  const hasPremium = activeVehicle
    ? hasAccess(activeVehicle.id, 'CARVERTICAL_REPORT')
    : false

  // Ownership guard: if the persisted session belongs to a different vehicle, do not
  // let its checklist/testDriveRatings corrupt this vehicle's score.
  const checklistOwned = !session?.vehicleId || session.vehicleId === (activeVehicle?.id ?? '')
  const ownedChecklistItems   = checklistOwned ? checklistItems   : ([] as typeof checklistItems)
  const ownedTestDriveRatings = checklistOwned ? testDriveRatings : ({} as typeof testDriveRatings)

  // Memoized calculation — recomputes only when inputs change
  const score = useMemo(() => {
    if (!activeVehicle) return null

    const aiFindings = aiResults.flatMap((r) => r.findings)
    const actionableIssuePhotos = aiResults.filter((result) =>
      result.findings.some((finding) => {
        const confidence = Number(finding.confidence)
        return finding.severity !== 'info' && Number.isFinite(confidence) && confidence >= 45
      })
    ).length
    const tdRatings: Record<string, number> = {}
    Object.entries(ownedTestDriveRatings).forEach(([k, v]) => {
      tdRatings[k] = v.rating
    })

    const input: ScoreCalculationInput = {
      aiFindings,
      photoCount: aiResults.length || null,
      issuePhotoCount: actionableIssuePhotos || null,
      checklistItems: ownedChecklistItems,
      vinData: null, // VIN data pulled server-side when premium
      testDriveRatings: tdRatings,
      hasPremiumHistory: hasPremium,
      askingPrice: activeVehicle.askingPrice ?? null,
    }

    return calculateRiskScore(activeVehicle.id, input)
  }, [activeVehicle?.id, ownedChecklistItems, aiResults, ownedTestDriveRatings, hasPremium])

  const buyScore = score?.buyScore ?? 0
  const riskScore = score?.riskScore ?? 0
  const verdict = score?.verdict ?? 'HIGH_RISK'
  const { label, emoji, color } = getVerdictLabel(verdict)

  return {
    score,
    buyScore,
    riskScore,
    verdictLabel: label,
    verdictEmoji: emoji,
    verdictColor: color,
    scoreColor: getScoreColor(buyScore),
    hasPremium,
  }
}
