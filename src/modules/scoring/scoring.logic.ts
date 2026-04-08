// =============================================================================
// Scoring Module — Risk Score Engine
// Pure business logic. No UI dependencies. Fully testable.
// =============================================================================

import type {
  ScoreCalculationInput,
  ScoreDimension,
  RiskScore,
  Verdict,
  AIFinding,
  ChecklistItem,
  VehicleHistoryResult,
  ServiceHistoryStatus,
} from '@/types'

// ─── Weight Configuration ─────────────────────────────────────────────────────
// Weights must sum to 100
export const SCORE_WEIGHTS = {
  ai: 25,
  exterior: 20,
  mechanical: 20,
  vin: 20,
  testDrive: 10,
  interior: 3,
  documents: 2,
} as const

// ─── Verdict Thresholds ───────────────────────────────────────────────────────
export const VERDICT_THRESHOLDS = {
  STRONG_BUY: 80,
  BUY_WITH_CAUTION: 60,
  HIGH_RISK: 40,
} as const

// ─── Damage cost threshold (EUR) above which a repair is flagged ─────────────
const HIGH_DAMAGE_COST_EUR = 3_000

// ─── AI Score Calculation ─────────────────────────────────────────────────────

function calculateAIScore(findings: AIFinding[]): ScoreDimension {
  if (findings.length === 0) {
    return {
      label: 'AI Photo Analysis',
      score: 88,
      weight: SCORE_WEIGHTS.ai,
      explanation: 'No AI findings. Photos appear clean.',
    }
  }

  const criticalCount = findings.filter((f) => f.severity === 'critical').length
  const warningCount  = findings.filter((f) => f.severity === 'warning').length

  let score = 100
  score -= criticalCount * 15
  score -= warningCount  * 7

  const avgConfidence = findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
  const confidenceModifier = (avgConfidence - 50) / 200
  score = score + score * confidenceModifier

  const clampedScore = Math.max(10, Math.min(100, Math.round(score)))

  const topIssue = [...findings].sort((a, b) => {
    const sev = { critical: 3, warning: 2, info: 1 }
    return sev[b.severity] - sev[a.severity]
  })[0]

  return {
    label: 'AI Photo Analysis',
    score: clampedScore,
    weight: SCORE_WEIGHTS.ai,
    explanation: `${findings.length} issue${findings.length > 1 ? 's' : ''} detected. Primary concern: ${topIssue?.title ?? 'N/A'} (confidence ${topIssue?.confidence ?? 0}%).`,
  }
}

// ─── Checklist Score Calculation ──────────────────────────────────────────────

function calculateChecklistScore(
  items: ChecklistItem[],
  category: ChecklistItem['category'],
  label: string,
  weight: number
): ScoreDimension {
  const categoryItems = items.filter((i) => i.category === category)

  if (categoryItems.length === 0) {
    return { label, score: 70, weight, explanation: 'Checklist not completed for this section.' }
  }

  const problemCount  = categoryItems.filter((i) => i.status === 'PROBLEM').length
  const warningCount  = categoryItems.filter((i) => i.status === 'WARNING').length
  const okCount       = categoryItems.filter((i) => i.status === 'OK').length
  const totalAssessed = problemCount + warningCount + okCount

  if (totalAssessed === 0) {
    return { label, score: 70, weight, explanation: 'No items assessed yet.' }
  }

  let score = 100
  score -= problemCount * 12
  score -= warningCount * 5
  const completionBonus = (totalAssessed / categoryItems.length) * 10
  score = Math.min(100, score + completionBonus)

  return {
    label,
    score: Math.max(10, Math.round(score)),
    weight,
    explanation: `${okCount} OK · ${warningCount} warnings · ${problemCount} problems across ${categoryItems.length} items.`,
  }
}

// ─── VIN / History Score ──────────────────────────────────────────────────────

function calculateVINScore(
  history: VehicleHistoryResult | null | undefined,
  hasPremium: boolean
): ScoreDimension {
  if (!hasPremium || !history) {
    return {
      label: 'VIN & History',
      score: 65,
      weight: SCORE_WEIGHTS.vin,
      explanation: 'Basic VIN decoded only. Upgrade to premium for full history scoring.',
    }
  }

  let score = 100

  if (history.theftStatus === 'reported_stolen') score -= 100
  if (history.totalLoss)           score -= 50
  if (history.outstandingFinance)  score -= 30
  score -= history.accidentCount * 12

  const mileageConsistent = isMileageConsistent(history.mileageHistory)
  if (!mileageConsistent) score -= 25

  const flagPenalties: Record<string, number> = {
    MILEAGE_ROLLBACK: 30,
    FLOOD_DAMAGE:     40,
    TAXI_USE:         10,
    IMPORT:            5,
  }
  history.riskFlags.forEach((flag) => {
    score -= flagPenalties[flag] ?? 5
  })

  return {
    label: 'VIN & History',
    score: Math.max(0, Math.min(100, Math.round(score))),
    weight: SCORE_WEIGHTS.vin,
    explanation: `${history.accidentCount} accident(s). ${history.recalls.filter((r) => r.status === 'incomplete').length} open recall(s). Mileage: ${mileageConsistent ? 'consistent' : 'inconsistent'}.`,
  }
}

function isMileageConsistent(records: VehicleHistoryResult['mileageHistory']): boolean {
  if (records.length < 2) return true
  const sorted = [...records].sort((a, b) => a.year - b.year || (a.month ?? 0) - (b.month ?? 0))
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].km < sorted[i - 1].km) return false
  }
  return true
}

// ─── Test Drive Score ─────────────────────────────────────────────────────────

function calculateTestDriveScore(ratings: Record<string, number>): ScoreDimension {
  const values = Object.values(ratings).filter((v) => v > 0)

  if (values.length === 0) {
    return { label: 'Test Drive', score: 72, weight: SCORE_WEIGHTS.testDrive, explanation: 'Test drive not yet completed.' }
  }

  const problemCount = values.filter((v) => v === 3).length
  const concernCount = values.filter((v) => v === 2).length
  const goodCount    = values.filter((v) => v === 1).length

  let score = 100
  score -= problemCount * 18
  score -= concernCount * 8
  score += goodCount    * 2

  return {
    label: 'Test Drive',
    score: Math.max(0, Math.min(100, Math.round(score))),
    weight: SCORE_WEIGHTS.testDrive,
    explanation: `${goodCount} good · ${concernCount} concerns · ${problemCount} problems observed during test drive.`,
  }
}

// ─── Service History Derivation ───────────────────────────────────────────────

/**
 * Reads the 'doc_service' checklist item to determine service history status.
 * OK → FULL, WARNING → PARTIAL, PROBLEM → NONE, PENDING/missing → PARTIAL (cautious default).
 */
export function deriveServiceHistoryStatus(items: ChecklistItem[]): ServiceHistoryStatus {
  const item = items.find((i) => i.itemKey === 'doc_service')
  if (!item || item.status === 'PENDING') return 'PARTIAL'
  if (item.status === 'OK')      return 'FULL'
  if (item.status === 'WARNING') return 'PARTIAL'
  if (item.status === 'PROBLEM') return 'NONE'
  return 'PARTIAL'
}

// ─── Service History Score Modifier ──────────────────────────────────────────

interface ServiceHistoryEffect {
  delta: number
  flags: string[]
  hints: string[]
}

function serviceHistoryEffect(status: ServiceHistoryStatus): ServiceHistoryEffect {
  switch (status) {
    case 'FULL':
      return { delta: 10, flags: [], hints: [] }
    case 'PARTIAL':
      return {
        delta: -5,
        flags: [],
        hints: ['Obtain full service records before finalising purchase.'],
      }
    case 'NONE':
      return {
        delta: -20,
        flags: ['NO_SERVICE_HISTORY'],
        hints: [
          'No verified service history — negotiate a price reduction of €1,000–€3,000.',
          'Request an independent pre-purchase inspection as a condition of sale.',
          'Budget for an immediate full service if you proceed.',
        ],
      }
    case 'SUSPICIOUS':
      return {
        delta: -25,
        flags: ['POSSIBLE_FAKE_HISTORY'],
        hints: [
          'Suspicious or inconsistent service records — treat as no history.',
          'Negotiate a price reduction of €2,000–€4,000.',
          'Walk away unless the seller can provide verifiable original receipts.',
        ],
      }
  }
}

// ─── Damage Penalty (from VIN premium data) ───────────────────────────────────

interface DamageEffect {
  delta: number
  flags: string[]
  hints: string[]
}

function damagePenalty(
  vinData: VehicleHistoryResult | null | undefined,
  hasPremium: boolean
): DamageEffect {
  if (!hasPremium || !vinData) return { delta: 0, flags: [], hints: [] }

  const flags: string[] = []
  const hints: string[] = []
  let delta = 0

  // Count-based penalty: 3+ accidents = serious damage pattern
  if (vinData.accidentCount >= 3) {
    delta -= 15
    flags.push('HIGH_DAMAGE_COUNT')
    hints.push(`${vinData.accidentCount} recorded accidents — negotiate at least €1,500 off asking price.`)
  }

  // Cost-based penalty
  const maxCostEur = vinData.damageHistory.reduce((max, d) => {
    if (!d.repairCostEstimate) return max
    // Normalise: treat RSD at approx 117 RSD/EUR, everything else as-is
    const eur = d.currency === 'RSD' ? d.repairCostEstimate / 117 : (d.repairCostEstimate ?? 0)
    return Math.max(max, eur)
  }, 0)

  if (maxCostEur > HIGH_DAMAGE_COST_EUR) {
    delta -= 10
    flags.push('HIGH_REPAIR_HISTORY')
    hints.push(`High recorded repair costs (>${HIGH_DAMAGE_COST_EUR.toLocaleString()} EUR) — budget for potential recurring issues.`)
  }

  return { delta, flags, hints }
}

// ─── Verdict Determination ────────────────────────────────────────────────────

function determineVerdict(buyScore: number): Verdict {
  if (buyScore >= VERDICT_THRESHOLDS.STRONG_BUY)     return 'STRONG_BUY'
  if (buyScore >= VERDICT_THRESHOLDS.BUY_WITH_CAUTION) return 'BUY_WITH_CAUTION'
  if (buyScore >= VERDICT_THRESHOLDS.HIGH_RISK)       return 'HIGH_RISK'
  return 'WALK_AWAY'
}

/**
 * Enforces hard verdict caps based on service history and damage.
 *
 * - NONE/SUSPICIOUS history → cannot be STRONG_BUY
 * - NONE/SUSPICIOUS + any recorded damage → capped at HIGH_RISK
 */
function enforceVerdictCaps(
  verdict: Verdict,
  serviceStatus: ServiceHistoryStatus,
  vinData: VehicleHistoryResult | null | undefined,
  dmgFlags: string[]
): Verdict {
  const noHistory = serviceStatus === 'NONE' || serviceStatus === 'SUSPICIOUS'
  if (!noHistory) return verdict

  // With no verified history, STRONG_BUY is never appropriate
  const afterHistoryCap: Verdict =
    verdict === 'STRONG_BUY' ? 'BUY_WITH_CAUTION' : verdict

  // No history + any recorded damage → cap at HIGH_RISK
  const hasDamage = (vinData?.accidentCount ?? 0) > 0 || dmgFlags.length > 0
  if (hasDamage && afterHistoryCap === 'BUY_WITH_CAUTION') {
    return 'HIGH_RISK'
  }

  return afterHistoryCap
}

// ─── Reason Generator ────────────────────────────────────────────────────────

function generateReasons(
  input: ScoreCalculationInput,
  serviceStatus: ServiceHistoryStatus,
  riskFlags: string[]
): { reasonsFor: string[]; reasonsAgainst: string[] } {
  const for_: string[] = []
  const against: string[] = []

  const { vinData, aiFindings, checklistItems, hasPremiumHistory } = input

  // Positive signals
  if (serviceStatus === 'FULL') for_.push('Full service history verified')

  if (hasPremiumHistory && vinData) {
    if (!vinData.totalLoss)           for_.push('No write-off or total loss recorded')
    if (!vinData.outstandingFinance)  for_.push('No outstanding finance found')
    if (vinData.theftStatus === 'clean') for_.push('Vehicle not reported stolen')
    if (isMileageConsistent(vinData.mileageHistory)) for_.push('Mileage progression is consistent')
    if (vinData.ownershipHistory.length <= 2) for_.push(`Only ${vinData.ownershipHistory.length} previous owner(s)`)
  }

  if (aiFindings.filter((f) => f.severity === 'critical').length === 0) {
    for_.push('No critical AI anomalies detected in photos')
  }

  const okItems = checklistItems.filter((i) => i.status === 'OK').length
  if (okItems > 15) for_.push(`${okItems} checklist items passed inspection`)

  // Negative signals
  if (riskFlags.includes('NO_SERVICE_HISTORY')) {
    against.push('No verified service history — major risk factor')
  }
  if (riskFlags.includes('POSSIBLE_FAKE_HISTORY')) {
    against.push('Service records appear suspicious or inconsistent')
  }
  if (riskFlags.includes('HIGH_DAMAGE_COUNT')) {
    against.push(`${vinData?.accidentCount ?? 3}+ accidents recorded in vehicle history`)
  }
  if (riskFlags.includes('HIGH_REPAIR_HISTORY')) {
    against.push('High recorded repair costs in vehicle history')
  }

  const criticalFindings = aiFindings.filter((f) => f.severity === 'critical')
  if (criticalFindings.length > 0) {
    against.push(`AI detected ${criticalFindings.length} critical visual anomaly`)
  }
  const warningFindings = aiFindings.filter((f) => f.severity === 'warning')
  if (warningFindings.length > 0) {
    against.push(`${warningFindings.length} AI warnings (paint, gaps, or trim)`)
  }
  if (hasPremiumHistory && vinData) {
    if (vinData.accidentCount > 0) against.push(`${vinData.accidentCount} accident(s) recorded in history`)
    const openRecalls = vinData.recalls.filter((r) => r.status === 'incomplete')
    if (openRecalls.length > 0) against.push(`${openRecalls.length} outstanding safety recall(s)`)
    if (vinData.outstandingFinance) against.push('Outstanding finance found — legal risk')
    if (!isMileageConsistent(vinData.mileageHistory)) against.push('Mileage inconsistency detected')
  }
  const problems = checklistItems.filter((i) => i.status === 'PROBLEM')
  if (problems.length > 0) against.push(`${problems.length} checklist item(s) marked as problem`)

  return {
    reasonsFor:     for_.slice(0, 5),
    reasonsAgainst: against.slice(0, 5),
  }
}

// ─── Internal dimension calculator ───────────────────────────────────────────

function calculateAllDimensions(input: ScoreCalculationInput) {
  const { aiFindings, checklistItems, vinData, testDriveRatings, hasPremiumHistory } = input

  return {
    ai:        calculateAIScore(aiFindings),
    exterior:  calculateChecklistScore(checklistItems, 'EXTERIOR',   'Exterior Inspection', SCORE_WEIGHTS.exterior),
    interior:  calculateChecklistScore(checklistItems, 'INTERIOR',   'Interior Inspection', SCORE_WEIGHTS.interior),
    mechanical:calculateChecklistScore(checklistItems, 'MECHANICAL', 'Mechanical Check',    SCORE_WEIGHTS.mechanical),
    vin:       calculateVINScore(vinData, hasPremiumHistory),
    testDrive: calculateTestDriveScore(testDriveRatings),
    documents: calculateChecklistScore(checklistItems, 'DOCUMENTS',  'Document Check',      SCORE_WEIGHTS.documents),
  }
}

// ─── Main Public API ──────────────────────────────────────────────────────────

/**
 * calculateRiskScore
 * Core scoring function. Pure logic — no DB calls, no API calls.
 *
 * Pipeline:
 *   1. Calculate dimension scores (weighted average)
 *   2. Apply service history modifier (±delta on final score)
 *   3. Apply damage penalty from VIN data
 *   4. Enforce hard verdict caps (no history + damage → HIGH_RISK)
 *   5. Generate risk flags, reasons, negotiation hints
 */
export function calculateRiskScore(
  vehicleId: string,
  input: ScoreCalculationInput
): Omit<RiskScore, 'id' | 'createdAt'> {
  const dimensions = calculateAllDimensions(input)

  // 1. Weighted average base score
  const totalWeight = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0)
  const weightedSum = Object.entries(dimensions).reduce((sum, [, dim]) => {
    return sum + dim.score * (dim.weight / totalWeight)
  }, 0)
  let buyScore = Math.max(10, Math.min(96, Math.round(weightedSum)))

  // 2. Service history modifier
  const serviceStatus = input.serviceHistoryStatus ?? deriveServiceHistoryStatus(input.checklistItems)
  const svcEffect     = serviceHistoryEffect(serviceStatus)
  buyScore = Math.max(10, Math.min(96, buyScore + svcEffect.delta))

  // 3. Damage penalty from VIN data
  const dmgEffect = damagePenalty(input.vinData, input.hasPremiumHistory)
  buyScore = Math.max(10, Math.min(96, buyScore + dmgEffect.delta))

  // 4. Determine base verdict then enforce caps
  let verdict = determineVerdict(buyScore)
  const riskFlags = [...svcEffect.flags, ...dmgEffect.flags]
  verdict = enforceVerdictCaps(verdict, serviceStatus, input.vinData, dmgEffect.flags)

  // 5. Reasons + negotiation hints
  const { reasonsFor, reasonsAgainst } = generateReasons(input, serviceStatus, riskFlags)
  const negotiationHints = [...svcEffect.hints, ...dmgEffect.hints].slice(0, 5)

  return {
    vehicleId,
    buyScore,
    riskScore: 100 - buyScore,
    verdict,
    dimensions,
    hasPremiumData: input.hasPremiumHistory,
    reasonsFor,
    reasonsAgainst,
    riskFlags,
    negotiationHints,
    serviceHistoryStatus: serviceStatus,
  }
}

/**
 * getVerdictLabel
 * Returns human-readable verdict label.
 */
export function getVerdictLabel(verdict: Verdict): { label: string; emoji: string; color: string } {
  const map: Record<Verdict, { label: string; emoji: string; color: string }> = {
    STRONG_BUY:       { label: 'Strong Buy',       emoji: '✅', color: '#00e676' },
    BUY_WITH_CAUTION: { label: 'Buy with Caution', emoji: '⚠️', color: '#ffaa00' },
    HIGH_RISK:        { label: 'High Risk',         emoji: '🔶', color: '#ff7700' },
    WALK_AWAY:        { label: 'Walk Away',         emoji: '❌', color: '#ff4757' },
  }
  return map[verdict]
}

/**
 * getScoreColor
 * CSS color for a raw score value.
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return '#00e676'
  if (score >= 60) return '#ffaa00'
  if (score >= 40) return '#ff7700'
  return '#ff4757'
}
