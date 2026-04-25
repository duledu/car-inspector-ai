// =============================================================================
// Scoring Module â€” Risk Score Engine
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

// â”€â”€â”€ Safe numeric helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Coerce any value to a finite number.
 * NaN, Infinity, null, undefined, empty string -> fallback.
 */
export function safeNumber(value: unknown, fallback: number): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function isValidFiniteNumber(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string' && value.trim() === '') return false
  return Number.isFinite(Number(value))
}

/**
 * Clamp score to [min, max] after coercing to a safe finite number.
 */
export function clampScore(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, Math.round(safeNumber(value, fallback))))
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function safeServiceHistoryStatus(value: unknown): ServiceHistoryStatus {
  return value === 'FULL' || value === 'PARTIAL' || value === 'NONE' || value === 'SUSPICIOUS'
    ? value
    : 'PARTIAL'
}

function logInvalidNumber(context: string, value: unknown, fallback: number) {
  if (value !== null && value !== undefined && value !== '' && !Number.isFinite(Number(value))) {
    console.warn('[scoring] invalid numeric value', { context, value, fallback })
  }
}

// â”€â”€â”€ Weight Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

export type ScoreDimensionKey = keyof RiskScore['dimensions']

// â”€â”€â”€ Verdict Thresholds â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const VERDICT_THRESHOLDS = {
  STRONG_BUY: 80,
  BUY_WITH_CAUTION: 60,
  HIGH_RISK: 40,
} as const

// â”€â”€â”€ Damage cost threshold (EUR) above which a repair is flagged â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const HIGH_DAMAGE_COST_EUR = 3_000
const MAX_NEGOTIATION_HINTS = 5
const NEGOTIATION_PLACEHOLDER_RE = /\b(?:placeholder|tbd|to be determined|lorem ipsum|sample text|example only|generic advice)\b|{{.+?}}|\[\[?.+?\]?\]/i
const EURO_SYMBOL = '\u20AC'
const EN_DASH = '\u2013'
const EM_DASH = '\u2014'
const MIDDLE_DOT = '\u00B7'

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeHintKey(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[â€“â€”]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .toLowerCase()
}

function formatEuroAmount(amount: number): string {
  return Math.round(amount).toLocaleString('en-US')
}

function roundNegotiationAmount(amount: number): number {
  const safeAmount = Math.max(0, amount)
  const step =
    safeAmount >= 2_000 ? 100 :
    safeAmount >= 500 ? 50 :
    25

  return Math.max(step, Math.round(safeAmount / step) * step)
}

function coercePositivePrice(value: unknown): number | null {
  const price = safeNumber(value, 0)
  return price > 0 ? price : null
}

function coercePositiveCount(value: unknown): number | null {
  const count = Math.round(safeNumber(value, 0))
  return count > 0 ? count : null
}

function buildNegotiationRange(
  askingPrice: number | null,
  fallbackMin: number,
  fallbackMax: number,
  minPercent: number,
  maxPercent: number
): { min: number; max: number } {
  if (!askingPrice) {
    return { min: fallbackMin, max: fallbackMax }
  }

  const min = roundNegotiationAmount(askingPrice * minPercent)
  const tentativeMax = roundNegotiationAmount(askingPrice * maxPercent)
  const minGap = min >= 2_000 ? 200 : min >= 500 ? 100 : 50
  const max = Math.max(tentativeMax, min + minGap)

  return { min, max }
}

function buildAccidentDiscount(askingPrice: number | null, accidentCount: number): number {
  if (!askingPrice) return 1_500

  const percent = Math.min(0.14, 0.03 + Math.max(0, accidentCount - 1) * 0.015)
  return roundNegotiationAmount(askingPrice * Math.max(0.04, percent))
}

function extractEuroAmounts(text: string): number[] {
  return Array.from(text.matchAll(/â‚¬\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)/g))
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
}

function hasInvalidNegotiationRange(text: string): boolean {
  const rangeMatch = text.match(/â‚¬\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)\s*[â€“-]\s*â‚¬\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)/)
  if (!rangeMatch) return false

  const min = Number(rangeMatch[1].replace(/,/g, ''))
  const max = Number(rangeMatch[2].replace(/,/g, ''))
  return !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min >= max
}

function isHintRealistic(text: string, askingPrice: number | null): boolean {
  if (hasInvalidNegotiationRange(text)) return false

  const amounts = extractEuroAmounts(text)
  if (amounts.length === 0 || !askingPrice) return true

  const highestAmount = Math.max(...amounts)
  const maxAllowedDiscount = Math.max(500, roundNegotiationAmount(askingPrice * 0.35))
  return highestAmount <= maxAllowedDiscount
}

type NegotiationBand = 'low' | 'mid' | 'high'

interface NegotiationProfile {
  band: NegotiationBand
  minPercent: number
  maxPercent: number
  step: number
}

function normalizeNegotiationHintKey(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .toLowerCase()
}

function getNegotiationProfile(askingPrice: number): NegotiationProfile {
  if (askingPrice < 1_000) {
    return { band: 'low', minPercent: 0.05, maxPercent: 0.15, step: 10 }
  }
  if (askingPrice < 3_000) {
    return { band: 'low', minPercent: 0.05, maxPercent: 0.15, step: 25 }
  }
  if (askingPrice < 15_000) {
    return { band: 'mid', minPercent: 0.05, maxPercent: 0.12, step: 50 }
  }
  return { band: 'high', minPercent: 0.03, maxPercent: 0.10, step: 100 }
}

function roundDiscountAmount(amount: number, step: number, direction: 'down' | 'nearest' | 'up' = 'nearest'): number {
  const safeAmount = Math.max(0, amount)
  if (safeAmount === 0) return 0

  const scaled = safeAmount / step
  const rounded =
    direction === 'down' ? Math.floor(scaled) :
    direction === 'up' ? Math.ceil(scaled) :
    Math.round(scaled)

  return Math.max(step, rounded * step)
}

function clampDiscountAmount(amount: number, askingPrice: number, step: number, direction: 'down' | 'nearest' | 'up' = 'nearest'): number {
  const hardCap = Math.min(amount, askingPrice * 0.3, askingPrice - 1)
  if (hardCap <= 0) return 0

  const rounded = roundDiscountAmount(hardCap, step, direction)
  const roundedCap = Math.floor(hardCap / step) * step
  if (rounded > hardCap && roundedCap >= step) return roundedCap
  return Math.min(rounded, hardCap)
}

function buildPriceAwareNegotiationRange(
  askingPrice: number | null,
  adjustment: { minPercentDelta?: number; maxPercentDelta?: number } = {}
): { min: number; max: number } | null {
  if (!askingPrice) return null

  const profile = getNegotiationProfile(askingPrice)
  const minPercent = Math.max(0.01, profile.minPercent + (adjustment.minPercentDelta ?? 0))
  const maxPercent = Math.max(minPercent + 0.01, profile.maxPercent + (adjustment.maxPercentDelta ?? 0))
  const minGap = profile.step * (profile.band === 'high' ? 2 : 1)

  let min = clampDiscountAmount(askingPrice * minPercent, askingPrice, profile.step, 'down')
  let max = clampDiscountAmount(askingPrice * maxPercent, askingPrice, profile.step, 'nearest')

  if (min <= 0) min = profile.step
  if (max <= min) {
    max = clampDiscountAmount(min + minGap, askingPrice, profile.step, 'up')
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) {
    return null
  }

  return { min, max }
}

function buildPriceAwareAccidentDiscount(askingPrice: number | null, accidentCount: number): number | null {
  if (!askingPrice) return null

  const profile = getNegotiationProfile(askingPrice)
  const basePercent = profile.band === 'high' ? 0.085 : 0.08
  const extraPercent = Math.max(0, accidentCount - 3) * 0.01
  const discount = clampDiscountAmount(
    askingPrice * Math.min(basePercent + extraPercent, 0.18),
    askingPrice,
    profile.step,
    'nearest'
  )

  return discount > 0 ? discount : null
}

function extractNegotiationEuroAmounts(text: string): number[] {
  return Array.from(text.matchAll(/\u20AC\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)/g))
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((amount) => Number.isFinite(amount) && amount > 0)
}

function hasInvalidPriceAwareNegotiationRange(text: string): boolean {
  const rangeMatch = text.match(/\u20AC\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)\s*[\u2013-]\s*\u20AC\s?(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?)/)
  if (!rangeMatch) return false

  const min = Number(rangeMatch[1].replace(/,/g, ''))
  const max = Number(rangeMatch[2].replace(/,/g, ''))
  return !Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0 || min >= max
}

function isPriceAwareHintRealistic(text: string, askingPrice: number | null): boolean {
  if (hasInvalidPriceAwareNegotiationRange(text)) return false

  const amounts = extractNegotiationEuroAmounts(text)
  if (amounts.length === 0 || !askingPrice) return true

  const highestAmount = Math.max(...amounts)
  const maxAllowedDiscount = Math.min(askingPrice * 0.3, askingPrice - 1)
  return highestAmount < askingPrice && highestAmount <= maxAllowedDiscount
}

export function normalizeNegotiationHints(
  hints: Array<string | null | undefined>,
  askingPrice?: number | null
): string[] {
  const safePrice = coercePositivePrice(askingPrice)
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const rawHint of safeArray<string | null | undefined>(hints)) {
    if (typeof rawHint !== 'string') continue

    const hint = normalizeWhitespace(rawHint)
    if (!hint) continue
    if (NEGOTIATION_PLACEHOLDER_RE.test(hint)) continue
    if (!isPriceAwareHintRealistic(hint, safePrice)) continue

    const key = normalizeNegotiationHintKey(hint)
    if (seen.has(key)) continue

    seen.add(key)
    normalized.push(hint)

    if (normalized.length >= MAX_NEGOTIATION_HINTS) break
  }

  return normalized
}

function capScoreForCategoryIssues(
  score: number,
  issueCount: number,
  issueRatio: number,
  seriousIssueCount: number
): { score: number; visualMaxScore?: number; hasMeaningfulIssues: boolean } {
  if (issueCount <= 0) {
    return { score, hasMeaningfulIssues: false }
  }

  let visualMaxScore = 89
  if (seriousIssueCount >= 2 || issueRatio >= 0.5) {
    visualMaxScore = 59
  } else if (seriousIssueCount >= 1 || issueCount >= 3 || issueRatio >= 0.3) {
    visualMaxScore = 74
  }

  return {
    score: Math.min(score, visualMaxScore),
    visualMaxScore,
    hasMeaningfulIssues: true,
  }
}

function getAIFindingImpactWeight(finding: AIFinding): number {
  const text = normalizeWhitespace(`${finding.title} ${finding.description} ${finding.area}`).toLowerCase()

  if (/(brake|airbag|abs|steering|suspension|wheel|tire|tyre|engine|gearbox|transmission|oil leak|coolant|fuel leak|structural|frame|chassis|crack|corrosion|rust|fire|flood|vin|document|odometer|mileage|tamper|recall|seatbelt|safety)/.test(text)) {
    return 1.45
  }
  if (/(panel mismatch|panel gap|door misalign|impact|collision|bumper|headlight|taillight|glass|windshield|windscreen|dent|paint damage|repaint|paint mismatch)/.test(text)) {
    return 1.15
  }
  if (/(scratch|scuff|chip|trim|cosmetic|upholstery|stain|paint)/.test(text)) {
    return 0.85
  }

  return finding.severity === 'critical' ? 1.2 : 1
}

// â”€â”€â”€ AI Score Calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calculateAIScore(
  findings: AIFinding[],
  photoCount?: number | null,
  issuePhotoCount?: number | null
): ScoreDimension {
  const safeFindings = safeArray<AIFinding>(findings).filter((f) => f && typeof f === 'object')
  const safePhotoCount = Math.max(
    coercePositiveCount(photoCount) ?? 0,
    coercePositiveCount(issuePhotoCount) ?? 0
  )
  const actionableFindings = safeFindings.filter((finding) => {
    logInvalidNumber('ai.confidence', finding.confidence, 55)
    const confidence = clampScore(finding.confidence, 0, 100, 55)
    return finding.severity !== 'info' && confidence >= 45
  })

  if (actionableFindings.length === 0) {
    if (safePhotoCount === 0) {
      return {
        label: 'AI Photo Analysis',
        score: 68,
        weight: SCORE_WEIGHTS.ai,
        explanation: 'No photo analysis data available. Upload more clear photos for a reliable AI assessment.',
        signals: { hasMeaningfulIssues: true, visualMaxScore: 74 },
      }
    }

    if (safePhotoCount < 5) {
      return {
        label: 'AI Photo Analysis',
        score: 82,
        weight: SCORE_WEIGHTS.ai,
        explanation: 'No obvious issues detected from available photos. Limited photo coverage reduces confidence.',
        signals: { hasMeaningfulIssues: true, visualMaxScore: 89, issueCount: 0, issueRatio: 0 },
      }
    }

    return {
      label: 'AI Photo Analysis',
      score: 92,
      weight: SCORE_WEIGHTS.ai,
      explanation: 'No obvious issues detected from available photos. Results are advisory only.',
    }
  }

  let score = 96
  actionableFindings.forEach((finding) => {
    const confidence = clampScore(finding.confidence, 0, 100, 55)
    const basePenalty = finding.severity === 'critical' ? 20 : 11
    const confidenceFactor =
      confidence >= 90 ? 1.3 :
      confidence >= 75 ? 1.12 :
      confidence >= 60 ? 0.92 :
      0.55
    score -= basePenalty * confidenceFactor * getAIFindingImpactWeight(finding)
  })

  const affectedPhotoCount = Math.min(
    safePhotoCount || actionableFindings.length,
    Math.max(
      coercePositiveCount(issuePhotoCount) ?? 0,
      Math.min(actionableFindings.length, safePhotoCount || actionableFindings.length)
    )
  )
  const issueRatio = safePhotoCount > 0
    ? affectedPhotoCount / safePhotoCount
    : Math.min(1, actionableFindings.length / 4)
  const averageConfidence = actionableFindings.reduce(
    (sum, finding) => sum + clampScore(finding.confidence, 0, 100, 55),
    0
  ) / actionableFindings.length
  const highestConfidence = actionableFindings.reduce(
    (max, finding) => Math.max(max, clampScore(finding.confidence, 0, 100, 55)),
    0
  )

  score -= issueRatio * 30
  score -= Math.max(0, affectedPhotoCount - 1) * 2.5
  if (averageConfidence >= 70) {
    score -= issueRatio * 10
  }

  const concernCounts = actionableFindings.reduce<Record<string, number>>((acc, finding) => {
    const key = normalizeWhitespace(finding.title).toLowerCase()
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const repeatedConcernCount = Object.values(concernCounts).reduce((max, count) => Math.max(max, count), 0)
  if (repeatedConcernCount > 1) {
    score -= (repeatedConcernCount - 1) * 7
  }

  const highImpactFinding = actionableFindings.some((finding) =>
    getAIFindingImpactWeight(finding) >= 1.4 && clampScore(finding.confidence, 0, 100, 55) >= 70
  )
  const criticalHighConfidenceFinding = actionableFindings.some((finding) =>
    finding.severity === 'critical' && clampScore(finding.confidence, 0, 100, 55) >= 75
  )
  const allIssuesMinorLike = actionableFindings.every((finding) =>
    finding.severity === 'warning'
    && clampScore(finding.confidence, 0, 100, 55) < 60
    && getAIFindingImpactWeight(finding) <= 0.9
  )

  let visualMaxScore: number | undefined
  if (issueRatio >= 0.5) {
    visualMaxScore = 59
  } else if (issueRatio >= 0.3) {
    visualMaxScore = allIssuesMinorLike ? 74 : 68
  }
  if (repeatedConcernCount >= 3 && averageConfidence >= 70) {
    visualMaxScore = Math.min(visualMaxScore ?? 68, 59)
  }
  if (criticalHighConfidenceFinding || highImpactFinding) {
    visualMaxScore = Math.min(visualMaxScore ?? 74, 59)
  }
  if (highestConfidence >= 90 && actionableFindings.length >= 2) {
    visualMaxScore = Math.min(visualMaxScore ?? 74, 59)
  }

  const clampedScore = clampScore(
    visualMaxScore !== undefined ? Math.min(score, visualMaxScore) : score,
    10,
    100,
    50
  )

  const topIssue = [...actionableFindings].sort((a, b) => {
    const sev: Record<string, number> = { critical: 3, warning: 2, info: 1 }
    return (sev[b.severity] ?? 0) - (sev[a.severity] ?? 0)
  })[0]
  const totalPhotos = safePhotoCount || actionableFindings.length || 1
  const issuePhotos = Math.max(1, Math.min(totalPhotos, affectedPhotoCount || actionableFindings.length))

  return {
    label: 'AI Photo Analysis',
    score: clampedScore,
    weight: SCORE_WEIGHTS.ai,
    explanation: `Issues detected in ${issuePhotos} of ${totalPhotos} photos. Main concern: ${topIssue?.title ?? 'N/A'}. Confidence: ${clampScore(topIssue?.confidence, 0, 100, 0)}%. Further manual inspection recommended.`,
    signals: {
      hasMeaningfulIssues: true,
      visualMaxScore,
      issueCount: actionableFindings.length,
      issueRatio,
      confidence: averageConfidence,
    },
  }
}

// â”€â”€â”€ Checklist Score Calculation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calculateChecklistScore(
  items: ChecklistItem[],
  category: ChecklistItem['category'],
  label: string,
  weight: number
): ScoreDimension {
  const categoryItems = safeArray<ChecklistItem>(items).filter((i) => i?.category === category)

  if (categoryItems.length === 0) {
    return {
      label,
      score: 70,
      weight,
      explanation: 'Checklist not completed for this section.',
      signals: { hasMeaningfulIssues: true, visualMaxScore: 74 },
    }
  }

  const problemCount  = categoryItems.filter((i) => i.status === 'PROBLEM').length
  const warningCount  = categoryItems.filter((i) => i.status === 'WARNING').length
  const okCount       = categoryItems.filter((i) => i.status === 'OK').length
  const totalAssessed = problemCount + warningCount + okCount

  if (totalAssessed === 0) {
    return {
      label,
      score: 70,
      weight,
      explanation: 'No items assessed yet.',
      signals: { hasMeaningfulIssues: true, visualMaxScore: 74 },
    }
  }

  const issueCount = warningCount + problemCount
  const issueRatio = totalAssessed > 0 ? issueCount / totalAssessed : 0
  const assessedRatio = categoryItems.length > 0 ? totalAssessed / categoryItems.length : 0

  let score =
    issueCount === 0
      ? 88 + assessedRatio * 10
      : 94 - (problemCount * 20) - (warningCount * 8) - (issueRatio * 16) - ((1 - assessedRatio) * 10)

  const capped = capScoreForCategoryIssues(score, issueCount, issueRatio, problemCount)
  score = capped.score

  return {
    label,
    score: clampScore(score, 10, 100, 70),
    weight,
    explanation: `${okCount} OK ${MIDDLE_DOT} ${warningCount} warnings ${MIDDLE_DOT} ${problemCount} problems across ${categoryItems.length} items.`,
    signals: {
      hasMeaningfulIssues: capped.hasMeaningfulIssues,
      visualMaxScore: capped.visualMaxScore,
      issueCount,
      issueRatio,
    },
  }
}

// â”€â”€â”€ VIN / History Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      signals: { hasMeaningfulIssues: true, visualMaxScore: 74 },
    }
  }

  let score = 97
  logInvalidNumber('vin.accidentCount', history.accidentCount, 0)
  const accidentCount = Math.max(0, Math.round(safeNumber(history.accidentCount, 0)))
  const mileageHistory = safeArray<VehicleHistoryResult['mileageHistory'][number]>(history.mileageHistory)
  const recalls = safeArray<VehicleHistoryResult['recalls'][number]>(history.recalls)
  const riskFlags = safeArray<string>(history.riskFlags)

  if (history.theftStatus === 'reported_stolen') score -= 100
  if (history.totalLoss)           score -= 55
  if (history.outstandingFinance)  score -= 30
  score -= accidentCount * 13

  const mileageConsistent = isMileageConsistent(mileageHistory)
  if (!mileageConsistent) score -= 28
  const openRecallCount = recalls.filter((r) => r?.status === 'incomplete').length
  score -= openRecallCount * 6

  const flagPenalties: Record<string, number> = {
    MILEAGE_ROLLBACK: 30,
    FLOOD_DAMAGE:     40,
    TAXI_USE:         10,
    IMPORT:            5,
  }
  riskFlags.forEach((flag) => {
    score -= flagPenalties[flag] ?? 5
  })

  const issueCount = accidentCount + openRecallCount + riskFlags.length
  const seriousIssueCount =
    (history.theftStatus === 'reported_stolen' ? 2 : 0)
    + (history.totalLoss ? 2 : 0)
    + (history.outstandingFinance ? 1 : 0)
    + (!mileageConsistent ? 1 : 0)
    + (accidentCount >= 3 ? 1 : 0)
    + (riskFlags.some((flag) => flag === 'FLOOD_DAMAGE' || flag === 'MILEAGE_ROLLBACK') ? 1 : 0)
  let visualMaxScore: number | undefined
  if (history.theftStatus === 'reported_stolen') {
    visualMaxScore = 25
  } else if (history.totalLoss || history.outstandingFinance || !mileageConsistent || accidentCount >= 3) {
    visualMaxScore = 59
  } else if (accidentCount > 0 || openRecallCount > 0 || riskFlags.length > 0) {
    visualMaxScore = 89
  }
  if (visualMaxScore !== undefined) {
    score = Math.min(score, visualMaxScore)
  }

  return {
    label: 'VIN & History',
    score: clampScore(score, 0, 100, 65),
    weight: SCORE_WEIGHTS.vin,
    explanation: `${accidentCount} accident(s). ${openRecallCount} open recall(s). Mileage: ${mileageConsistent ? 'consistent' : 'inconsistent'}.`,
    signals: {
      hasMeaningfulIssues:
        accidentCount > 0
        || openRecallCount > 0
        || riskFlags.length > 0
        || history.outstandingFinance
        || history.totalLoss
        || history.theftStatus === 'reported_stolen'
        || !mileageConsistent,
      visualMaxScore,
      issueCount,
      issueRatio: issueCount > 0 ? Math.min(1, issueCount / 5) : 0,
      confidence: seriousIssueCount > 0 ? 85 : 60,
    },
  }
}

function isMileageConsistent(records: VehicleHistoryResult['mileageHistory'] | unknown): boolean {
  const validRecords = safeArray<VehicleHistoryResult['mileageHistory'][number]>(records)
    .filter((r) => isValidFiniteNumber(r?.year) && isValidFiniteNumber(r?.km))

  if (validRecords.length < 2) return true
  const sorted = [...validRecords].sort((a, b) => {
    const yearDiff = safeNumber(a.year, 0) - safeNumber(b.year, 0)
    if (yearDiff !== 0) return yearDiff
    return safeNumber(a.month, 0) - safeNumber(b.month, 0)
  })
  for (let i = 1; i < sorted.length; i++) {
    if (safeNumber(sorted[i].km, 0) < safeNumber(sorted[i - 1].km, 0)) return false
  }
  return true
}

// â”€â”€â”€ Test Drive Score â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calculateTestDriveScore(ratings: Record<string, number>): ScoreDimension {
  const values = Object.values(ratings && typeof ratings === 'object' ? ratings : {})
    .map((v) => clampScore(v, 0, 3, 0))
    .filter((v) => v > 0)

  if (values.length === 0) {
    return {
      label: 'Test Drive',
      score: 72,
      weight: SCORE_WEIGHTS.testDrive,
      explanation: 'Test drive not yet completed.',
      signals: { hasMeaningfulIssues: true, visualMaxScore: 74 },
    }
  }

  const problemCount = values.filter((v) => v === 3).length
  const concernCount = values.filter((v) => v === 2).length
  const goodCount    = values.filter((v) => v === 1).length

  const issueCount = problemCount + concernCount
  const issueRatio = values.length > 0 ? issueCount / values.length : 0

  let score =
    issueCount === 0
      ? Math.min(98, 90 + (goodCount * 2))
      : 94 - (problemCount * 22) - (concernCount * 10) + goodCount

  const capped = capScoreForCategoryIssues(score, issueCount, issueRatio, problemCount)
  score = capped.score

  return {
    label: 'Test Drive',
    score: clampScore(score, 0, 100, 72),
    weight: SCORE_WEIGHTS.testDrive,
    explanation: `${goodCount} good ${MIDDLE_DOT} ${concernCount} concerns ${MIDDLE_DOT} ${problemCount} problems observed during test drive.`,
    signals: {
      hasMeaningfulIssues: capped.hasMeaningfulIssues,
      visualMaxScore: capped.visualMaxScore,
      issueCount,
      issueRatio,
    },
  }
}

// â”€â”€â”€ Service History Derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Reads the 'doc_service' checklist item to determine service history status.
 * OK â†’ FULL, WARNING â†’ PARTIAL, PROBLEM â†’ NONE, PENDING/missing â†’ PARTIAL (cautious default).
 */
export function deriveServiceHistoryStatus(items: ChecklistItem[]): ServiceHistoryStatus {
  const item = safeArray<ChecklistItem>(items).find((i) => i?.itemKey === 'doc_service')
  if (!item || item.status === 'PENDING') return 'PARTIAL'
  if (item.status === 'OK')      return 'FULL'
  if (item.status === 'WARNING') return 'PARTIAL'
  if (item.status === 'PROBLEM') return 'NONE'
  return 'PARTIAL'
}

// â”€â”€â”€ Service History Score Modifier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ServiceHistoryEffect {
  delta: number
  flags: string[]
  hints: string[]
}

function serviceHistoryEffect(
  status: ServiceHistoryStatus,
  askingPrice?: number | null
): ServiceHistoryEffect {
  const safeAskingPrice = coercePositivePrice(askingPrice)
  switch (status) {
    case 'FULL':
      return { delta: 10, flags: [], hints: [] }
    case 'PARTIAL':
      return {
        delta: -5,
        flags: [],
        hints: ['Obtain full service records before finalising purchase.'],
      }
    case 'NONE': {
      const discount = buildNegotiationRange(safeAskingPrice, 1_000, 3_000, 0.05, 0.12)
      return {
        delta: -20,
        flags: ['NO_SERVICE_HISTORY'],
        hints: [
          `No verified service history â€” negotiate a price reduction of â‚¬${formatEuroAmount(discount.min)}â€“â‚¬${formatEuroAmount(discount.max)}.`,
          'Request an independent pre-purchase inspection as a condition of sale.',
          'Budget for an immediate full service if you proceed.',
        ],
      }
    }
    case 'SUSPICIOUS': {
      const discount = buildNegotiationRange(safeAskingPrice, 2_000, 4_000, 0.08, 0.16)
      return {
        delta: -25,
        flags: ['POSSIBLE_FAKE_HISTORY'],
        hints: [
          'Suspicious or inconsistent service records â€” treat as no history.',
          `Negotiate a price reduction of â‚¬${formatEuroAmount(discount.min)}â€“â‚¬${formatEuroAmount(discount.max)}.`,
          'Walk away unless the seller can provide verifiable original receipts.',
        ],
      }
    }
  }
}

function serviceHistoryEffectV2(
  status: ServiceHistoryStatus,
  askingPrice?: number | null
): ServiceHistoryEffect {
  const safeAskingPrice = coercePositivePrice(askingPrice)
  const profile = safeAskingPrice ? getNegotiationProfile(safeAskingPrice) : null

  switch (status) {
    case 'FULL':
      return { delta: 10, flags: [], hints: [] }
    case 'PARTIAL':
      return {
        delta: -5,
        flags: [],
        hints: ['Obtain full service records before finalising purchase.'],
      }
    case 'NONE': {
      const discount = buildPriceAwareNegotiationRange(safeAskingPrice, {
        minPercentDelta:
          profile?.band === 'high' ? 0.02 :
          profile?.band === 'mid' ? 0.005 :
          0,
        maxPercentDelta:
          profile?.band === 'high' ? 0.02 :
          profile?.band === 'mid' ? 0.005 :
          0,
      })
      return {
        delta: -20,
        flags: ['NO_SERVICE_HISTORY'],
        hints: [
          ...(discount
            ? [`No verified service history ${EM_DASH} negotiate a price reduction of ${EURO_SYMBOL}${formatEuroAmount(discount.min)}${EN_DASH}${EURO_SYMBOL}${formatEuroAmount(discount.max)}.`]
            : ['No verified service history. Negotiate based on the missing maintenance risk.']),
          'Request an independent pre-purchase inspection as a condition of sale.',
          'Budget for an immediate full service if you proceed.',
        ],
      }
    }
    case 'SUSPICIOUS': {
      const discount = buildPriceAwareNegotiationRange(safeAskingPrice, {
        minPercentDelta:
          profile?.band === 'high' ? 0.025 :
          profile?.band === 'mid' ? 0.01 :
          0.01,
        maxPercentDelta:
          profile?.band === 'high' ? 0.02 :
          profile?.band === 'mid' ? 0.015 :
          0.02,
      })
      return {
        delta: -25,
        flags: ['POSSIBLE_FAKE_HISTORY'],
        hints: [
          `Suspicious or inconsistent service records ${EM_DASH} treat as no history.`,
          ...(discount
            ? [`Negotiate a price reduction of ${EURO_SYMBOL}${formatEuroAmount(discount.min)}${EN_DASH}${EURO_SYMBOL}${formatEuroAmount(discount.max)}.`]
            : ['Negotiate a meaningful reduction to offset the history risk.']),
          'Walk away unless the seller can provide verifiable original receipts.',
        ],
      }
    }
  }
}

// â”€â”€â”€ Damage Penalty (from VIN premium data) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface DamageEffect {
  delta: number
  flags: string[]
  hints: string[]
}

function damagePenalty(
  vinData: VehicleHistoryResult | null | undefined,
  hasPremium: boolean,
  askingPrice?: number | null
): DamageEffect {
  if (!hasPremium || !vinData) return { delta: 0, flags: [], hints: [] }

  const flags: string[] = []
  const hints: string[] = []
  let delta = 0

  // Count-based penalty: 3+ accidents = serious damage pattern
  logInvalidNumber('vin.accidentCount', vinData.accidentCount, 0)
  const accidentCount = Math.max(0, Math.round(safeNumber(vinData.accidentCount, 0)))
  if (accidentCount >= 3) {
    delta -= 15
    flags.push('HIGH_DAMAGE_COUNT')
    const accidentDiscount = buildAccidentDiscount(coercePositivePrice(askingPrice), accidentCount)
    hints.push(`${accidentCount} recorded accidents â€” negotiate at least â‚¬${formatEuroAmount(accidentDiscount)} off asking price.`)
  }

  // Cost-based penalty
  const maxCostEur = safeArray<VehicleHistoryResult['damageHistory'][number]>(vinData.damageHistory).reduce((max, d) => {
    if (!isValidFiniteNumber(d?.repairCostEstimate)) return max
    // Normalise: treat RSD at approx 117 RSD/EUR, everything else as-is
    const repairCost = safeNumber(d.repairCostEstimate, 0)
    const eur = d.currency === 'RSD' ? repairCost / 117 : repairCost
    return Math.max(max, eur)
  }, 0)

  if (maxCostEur > HIGH_DAMAGE_COST_EUR) {
    delta -= 10
    flags.push('HIGH_REPAIR_HISTORY')
    hints.push(`High recorded repair costs (>${HIGH_DAMAGE_COST_EUR.toLocaleString()} EUR) â€” budget for potential recurring issues.`)
  }

  return { delta, flags, hints }
}

function damagePenaltyV2(
  vinData: VehicleHistoryResult | null | undefined,
  hasPremium: boolean,
  askingPrice?: number | null
): DamageEffect {
  if (!hasPremium || !vinData) return { delta: 0, flags: [], hints: [] }

  const flags: string[] = []
  const hints: string[] = []
  let delta = 0

  logInvalidNumber('vin.accidentCount', vinData.accidentCount, 0)
  const accidentCount = Math.max(0, Math.round(safeNumber(vinData.accidentCount, 0)))
  if (accidentCount >= 3) {
    delta -= 15
    flags.push('HIGH_DAMAGE_COUNT')
    const accidentDiscount = buildPriceAwareAccidentDiscount(coercePositivePrice(askingPrice), accidentCount)
    if (accidentDiscount) {
      hints.push(`${accidentCount} recorded accidents ${EM_DASH} negotiate at least ${EURO_SYMBOL}${formatEuroAmount(accidentDiscount)} off asking price.`)
    }
  }

  const maxCostEur = safeArray<VehicleHistoryResult['damageHistory'][number]>(vinData.damageHistory).reduce((max, d) => {
    if (!isValidFiniteNumber(d?.repairCostEstimate)) return max
    const repairCost = safeNumber(d.repairCostEstimate, 0)
    const eur = d.currency === 'RSD' ? repairCost / 117 : repairCost
    return Math.max(max, eur)
  }, 0)

  if (maxCostEur > HIGH_DAMAGE_COST_EUR) {
    delta -= 10
    flags.push('HIGH_REPAIR_HISTORY')
    hints.push(`High recorded repair costs (> ${HIGH_DAMAGE_COST_EUR.toLocaleString()} EUR) ${EM_DASH} budget for potential recurring issues.`)
  }

  return { delta, flags, hints }
}

// â”€â”€â”€ Verdict Determination â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function determineVerdict(buyScore: number): Verdict {
  const safeScore = clampScore(buyScore, 0, 100, 0)
  if (safeScore >= VERDICT_THRESHOLDS.STRONG_BUY)     return 'STRONG_BUY'
  if (safeScore >= VERDICT_THRESHOLDS.BUY_WITH_CAUTION) return 'BUY_WITH_CAUTION'
  if (safeScore >= VERDICT_THRESHOLDS.HIGH_RISK)       return 'HIGH_RISK'
  return 'WALK_AWAY'
}

/**
 * Enforces hard verdict caps based on service history and damage.
 *
 * - NONE/SUSPICIOUS history â†’ cannot be STRONG_BUY
 * - NONE/SUSPICIOUS + any recorded damage â†’ capped at HIGH_RISK
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

  // No history + any recorded damage â†’ cap at HIGH_RISK
  const hasDamage = safeNumber(vinData?.accidentCount, 0) > 0 || dmgFlags.length > 0
  if (hasDamage && afterHistoryCap === 'BUY_WITH_CAUTION') {
    return 'HIGH_RISK'
  }

  return afterHistoryCap
}

// â”€â”€â”€ Reason Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function generateReasons(
  input: ScoreCalculationInput,
  serviceStatus: ServiceHistoryStatus,
  riskFlags: string[]
): { reasonsFor: string[]; reasonsAgainst: string[] } {
  const for_: string[] = []
  const against: string[] = []

  const { vinData, hasPremiumHistory } = input
  const aiFindings = safeArray<AIFinding>(input.aiFindings)
  const checklistItems = safeArray<ChecklistItem>(input.checklistItems)

  // Positive signals
  if (serviceStatus === 'FULL') for_.push('Full service history verified')

  if (hasPremiumHistory && vinData) {
    if (!vinData.totalLoss)           for_.push('No write-off or total loss recorded')
    if (!vinData.outstandingFinance)  for_.push('No outstanding finance found')
    if (vinData.theftStatus === 'clean') for_.push('Vehicle not reported stolen')
    if (isMileageConsistent(vinData.mileageHistory)) for_.push('Mileage progression is consistent')
    const ownerCount = safeArray(vinData.ownershipHistory).length
    if (ownerCount <= 2) for_.push(`Only ${ownerCount} previous owner(s)`)
  }

  // Only claim "no anomalies" when there are truly no findings at all.
  if (aiFindings.length === 0) {
    for_.push('No critical AI anomalies detected in photos')
  }

  const okItems = checklistItems.filter((i) => i.status === 'OK').length
  if (okItems > 15) for_.push(`${okItems} checklist items passed inspection`)

  // Negative signals
  if (riskFlags.includes('NO_SERVICE_HISTORY')) {
    against.push('No verified service history â€” major risk factor')
  }
  if (riskFlags.includes('POSSIBLE_FAKE_HISTORY')) {
    against.push('Service records appear suspicious or inconsistent')
  }
  if (riskFlags.includes('HIGH_DAMAGE_COUNT')) {
    against.push(`${Math.max(3, Math.round(safeNumber(vinData?.accidentCount, 3)))}+ accidents recorded in vehicle history`)
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
    const accidentCount = Math.max(0, Math.round(safeNumber(vinData.accidentCount, 0)))
    if (accidentCount > 0) against.push(`${accidentCount} accident(s) recorded in history`)
    const openRecalls = safeArray<VehicleHistoryResult['recalls'][number]>(vinData.recalls).filter((r) => r?.status === 'incomplete')
    if (openRecalls.length > 0) against.push(`${openRecalls.length} outstanding safety recall(s)`)
    if (vinData.outstandingFinance) against.push('Outstanding finance found â€” legal risk')
    if (!isMileageConsistent(vinData.mileageHistory)) against.push('Mileage inconsistency detected')
  }
  const problems = checklistItems.filter((i) => i.status === 'PROBLEM')
  if (problems.length > 0) against.push(`${problems.length} checklist item(s) marked as problem`)

  return {
    reasonsFor:     for_.slice(0, 5),
    reasonsAgainst: against.slice(0, 5),
  }
}

// â”€â”€â”€ Internal dimension calculator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function calculateAllDimensions(input: ScoreCalculationInput) {
  const { aiFindings, photoCount, issuePhotoCount, checklistItems, vinData, testDriveRatings, hasPremiumHistory } = input

  return {
    ai:        calculateAIScore(safeArray<AIFinding>(aiFindings), photoCount, issuePhotoCount),
    exterior:  calculateChecklistScore(safeArray<ChecklistItem>(checklistItems), 'EXTERIOR',   'Exterior Inspection', SCORE_WEIGHTS.exterior),
    interior:  calculateChecklistScore(safeArray<ChecklistItem>(checklistItems), 'INTERIOR',   'Interior Inspection', SCORE_WEIGHTS.interior),
    mechanical:calculateChecklistScore(safeArray<ChecklistItem>(checklistItems), 'MECHANICAL', 'Mechanical Check',    SCORE_WEIGHTS.mechanical),
    vin:       calculateVINScore(vinData, hasPremiumHistory),
    testDrive: calculateTestDriveScore(testDriveRatings ?? {}),
    documents: calculateChecklistScore(safeArray<ChecklistItem>(checklistItems), 'DOCUMENTS',  'Document Check',      SCORE_WEIGHTS.documents),
  }
}

// â”€â”€â”€ Main Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * calculateRiskScore
 * Core scoring function. Pure logic â€” no DB calls, no API calls.
 *
 * Pipeline:
 *   1. Calculate dimension scores (weighted average)
 *   2. Apply service history modifier (Â±delta on final score)
 *   3. Apply damage penalty from VIN data
 *   4. Enforce hard verdict caps (no history + damage â†’ HIGH_RISK)
 *   5. Generate risk flags, reasons, negotiation hints
 */
export function calculateRiskScore(
  vehicleId: string,
  input: ScoreCalculationInput
): Omit<RiskScore, 'id' | 'createdAt'> {
  const dimensions = calculateAllDimensions(input)

  // 1. Weighted average base score
  const totalWeight = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0)
  const safeTotalWeight = safeNumber(totalWeight, 100) > 0 ? safeNumber(totalWeight, 100) : 100
  const weightedSum = Object.entries(dimensions).reduce((sum, [key, dim]) => {
    logInvalidNumber(`dimension.${key}.score`, dim.score, 50)
    logInvalidNumber(`dimension.${key}.weight`, dim.weight, 0)
    const s = clampScore(dim.score, 0, 100, 50)
    const w = safeNumber(dim.weight, 0)
    return sum + s * (w / safeTotalWeight)
  }, 0)
  let buyScore = clampScore(weightedSum, 10, 96, 50)

  // 2. Service history modifier
  const serviceStatus = safeServiceHistoryStatus(input.serviceHistoryStatus ?? deriveServiceHistoryStatus(input.checklistItems))
  const svcEffect     = serviceHistoryEffectV2(serviceStatus, input.askingPrice)
  buyScore = clampScore(buyScore + svcEffect.delta, 10, 96, 50)

  // 3. Damage penalty from VIN data
  const dmgEffect = damagePenaltyV2(input.vinData, input.hasPremiumHistory, input.askingPrice)
  buyScore = clampScore(buyScore + dmgEffect.delta, 10, 96, 50)

  // 4. Determine base verdict then enforce caps
  let verdict = determineVerdict(buyScore)
  const riskFlags = [...svcEffect.flags, ...dmgEffect.flags]
  verdict = enforceVerdictCaps(verdict, serviceStatus, input.vinData, dmgEffect.flags)

  // 5. Reasons + negotiation hints
  const { reasonsFor, reasonsAgainst } = generateReasons(input, serviceStatus, riskFlags)
  const negotiationHints = normalizeNegotiationHints(
    [...svcEffect.hints, ...dmgEffect.hints],
    input.askingPrice
  )

  return {
    vehicleId,
    buyScore,
    riskScore: clampScore(100 - buyScore, 4, 90, 50),
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

export function calculatePreliminaryRiskScore(
  vehicleId: string,
  input: ScoreCalculationInput,
  completedDimensions: Partial<Record<ScoreDimensionKey, boolean>>
): Omit<RiskScore, 'id' | 'createdAt'> {
  const dimensions = calculateAllDimensions(input)

  const includedDimensions = Object.entries(dimensions).filter(
    ([key]) => completedDimensions[key as ScoreDimensionKey]
  ) as Array<[ScoreDimensionKey, RiskScore['dimensions'][ScoreDimensionKey]]>

  if (includedDimensions.length === 0) {
    return calculateRiskScore(vehicleId, input)
  }

  const totalWeight = includedDimensions.reduce((sum, [, dim]) => sum + safeNumber(dim.weight, 0), 0)
  const safeTotalWeight = safeNumber(totalWeight, 0) > 0 ? safeNumber(totalWeight, 0) : 100

  const weightedSum = includedDimensions.reduce((sum, [, dim]) => {
    return sum + clampScore(dim.score, 0, 100, 50) * (safeNumber(dim.weight, 0) / safeTotalWeight)
  }, 0)

  let buyScore = clampScore(weightedSum, 10, 96, 50)

  const hasServiceInput = safeArray<ChecklistItem>(input.checklistItems).some(
    (item) => item?.itemKey === 'doc_service' && item.status !== 'PENDING'
  )
  const serviceStatus = hasServiceInput
    ? safeServiceHistoryStatus(input.serviceHistoryStatus ?? deriveServiceHistoryStatus(input.checklistItems))
    : 'PARTIAL'
  const svcEffect = hasServiceInput
    ? serviceHistoryEffectV2(serviceStatus, input.askingPrice)
    : { delta: 0, flags: [], hints: [] }
  buyScore = clampScore(buyScore + svcEffect.delta, 10, 96, 50)

  const hasVinInput = !!completedDimensions.vin
  const dmgEffect = hasVinInput
    ? damagePenaltyV2(input.vinData, input.hasPremiumHistory, input.askingPrice)
    : { delta: 0, flags: [], hints: [] }
  buyScore = clampScore(buyScore + dmgEffect.delta, 10, 96, 50)

  let verdict = determineVerdict(buyScore)
  const riskFlags = [...svcEffect.flags, ...dmgEffect.flags]
  verdict = enforceVerdictCaps(
    verdict,
    serviceStatus,
    hasVinInput ? input.vinData : null,
    dmgEffect.flags,
  )

  const reasonInput: ScoreCalculationInput = {
    ...input,
    vinData: hasVinInput ? input.vinData : null,
    hasPremiumHistory: hasVinInput ? input.hasPremiumHistory : false,
  }
  const { reasonsFor, reasonsAgainst } = generateReasons(reasonInput, serviceStatus, riskFlags)
  const negotiationHints = normalizeNegotiationHints(
    [...svcEffect.hints, ...dmgEffect.hints],
    input.askingPrice
  )

  return {
    vehicleId,
    buyScore,
    riskScore: clampScore(100 - buyScore, 4, 90, 50),
    verdict,
    dimensions,
    hasPremiumData: hasVinInput && input.hasPremiumHistory,
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
    STRONG_BUY:       { label: 'Strong Buy',       emoji: '\u2705', color: '#00e676' },
    BUY_WITH_CAUTION: { label: 'Buy with Caution', emoji: '\u26A0\uFE0F', color: '#ffaa00' },
    HIGH_RISK:        { label: 'High Risk',        emoji: '\uD83D\uDD36', color: '#ff7700' },
    WALK_AWAY:        { label: 'Walk Away',        emoji: '\u274C', color: '#ff4757' },
  }
  return map[verdict]
}

/**
 * getScoreColor
 * CSS color for a raw score value.
 */
export function getScoreColor(score: number): string {
  const safeScore = clampScore(score, 0, 100, 0)
  if (safeScore >= 90) return '#00e676'
  if (safeScore >= 75) return '#84cc16'
  if (safeScore >= 60) return '#ffaa00'
  if (safeScore >= 40) return '#ff7700'
  return '#ff4757'
}





