// =============================================================================
// Vehicle Research Service
// AI provider: Anthropic Claude (primary) â†’ knowledge base fallback
// Pricing: pricing.service runs in parallel, result merged into priceContext
// =============================================================================

import type { VehicleResearchResult, PriceContext, ResearchIssue, ResearchSection, ResearchTagType } from '@/types'
import { generateFallbackResult }                   from './fallback.knowledge'
import { pricingService }                           from '@/modules/pricing/pricing.service'
import type { MarketPriceResult }                   from '@/modules/pricing/provider.interface'
import { normalizeVehicle }                         from '@/lib/vehicle/normalize'
import { matchIssues }                              from '@/lib/vehicle/matcher'
import { allIssues }                                from '../../../data/vehicle-issues'
import type { MatchedIssue }                        from '@/lib/vehicle/types'

export interface ResearchParams {
  make: string
  model: string
  year: number
  engineCc?: number
  powerKw?: number
  engine?: string
  trim?: string
  askingPrice?: number
  currency?: string
  fuelType?: string
  transmission?: string
  drivetrain?: string
  bodyType?: string
  mileage?: number
  locale?: string
}

export interface ResearchOutput extends VehicleResearchResult {
  limitedMode:   boolean
  kbIssues:      MatchedIssue[]
  kbMatchCount:  number
}

function fallbackReasonFor(aiConfigured: boolean): VehicleResearchResult['fallbackReason'] {
  return aiConfigured ? 'ai_unavailable' : 'missing_ai_config'
}

// â”€â”€â”€ Prompt builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeLocale(locale?: string): string {
  return (locale ?? 'en').toLowerCase().split('-')[0]
}

function languageInstruction(locale?: string): string {
  switch (normalizeLocale(locale)) {
    case 'sr':
      return 'Respond in Serbian (Latin script). Use natural, professional automotive terminology used in Serbia. Keep all JSON keys exactly as specified in English.'
    case 'bg':
      return 'Respond in Bulgarian. Use professional automotive terminology natural for Bulgarian buyers. Keep all JSON keys exactly as specified in English.'
    case 'mk':
      return 'Respond in Macedonian. Use professional automotive terminology. Keep all JSON keys exactly as specified in English.'
    case 'de':
      return 'Respond in German. Use professional automotive terminology. Keep all JSON keys exactly as specified in English.'
    case 'sq':
      return 'Respond in Albanian. Use professional automotive terminology. Keep all JSON keys exactly as specified in English.'
    default:
      return 'Respond in English. Use professional automotive terminology. Keep all JSON keys exactly as specified.'
  }
}

/**
 * Locale-specific section titles injected into the JSON schema template.
 * Without these, the AI tends to copy the English placeholder titles verbatim
 * even when instructed to respond in another language.
 */
function sectionTitles(locale?: string): Record<string, string> {
  switch (normalizeLocale(locale)) {
    case 'de': return {
      commonProblems:      'Häufige Probleme',
      highPriorityChecks:  'Prioritätschecks',
      visualAttention:     'Visuelle Prüfpunkte',
      mechanicalWatchouts: 'Mechanische Warnzeichen',
      testDriveFocus:      'Probefahrt-Fokus',
      costAwareness:       'Kostenbewusstsein',
    }
    case 'sr': return {
      commonProblems:      'Česti problemi',
      highPriorityChecks:  'Prioritetne provere',
      visualAttention:     'Vizuelne tačke pažnje',
      mechanicalWatchouts: 'Mehaničke provere',
      testDriveFocus:      'Fokus na test vožnji',
      costAwareness:       'Troškovi i pregovori',
    }
    case 'bg': return {
      commonProblems:      'Чести проблеми',
      highPriorityChecks:  'Приоритетни проверки',
      visualAttention:     'Визуални зони за внимание',
      mechanicalWatchouts: 'Механични рискове',
      testDriveFocus:      'Фокус при тест драйв',
      costAwareness:       'Разходи и преговори',
    }
    case 'mk': return {
      commonProblems:      'Чести проблеми',
      highPriorityChecks:  'Приоритетни проверки',
      visualAttention:     'Визуелни точки за внимание',
      mechanicalWatchouts: 'Механички проверки',
      testDriveFocus:      'Фокус на тест возење',
      costAwareness:       'Трошоци и преговори',
    }
    case 'sq': return {
      commonProblems:      'Problemet e Zakonshme',
      highPriorityChecks:  'Kontrollet Prioritare',
      visualAttention:     'Pikat e Vëmendjes Vizuale',
      mechanicalWatchouts: 'Sinjalet Mekanike',
      testDriveFocus:      'Fokusi i Vozitjes Provë',
      costAwareness:       'Ndërgjegjësimi i Kostove',
    }
    default: return {
      commonProblems:      'Common Problems',
      highPriorityChecks:  'High-Priority Checks',
      visualAttention:     'Visual Attention Areas',
      mechanicalWatchouts: 'Mechanical Watchouts',
      testDriveFocus:      'Test Drive Focus',
      costAwareness:       'Cost Awareness',
    }
  }
}

function buildKbContext(kbIssues: MatchedIssue[]): string {
  if (kbIssues.length === 0) return ''
  // Emit compact KB context so AI can enrich without repeating deterministic KB content.
  const lines = kbIssues
    .map(i => `- [${i.severity.toUpperCase()}/${i.category}] ${i.title}: ${i.inspectionAdvice.slice(0, 240)}`)
    .join('\n')
  return `\n\nDETERMINISTIC VEHICLE-SPECIFIC KB ISSUES (these will be inserted into the visible guide before your items):\n${lines}\n\nYour output must add only complementary, vehicle-specific findings. Do not repeat these titles or rewrite generic used-car checklist items unless they are genuinely specific to this exact vehicle identity.`
}

function buildPrompt(params: ResearchParams, kbIssues: MatchedIssue[] = []): string {
  const { make, model, year, engineCc, powerKw, engine, trim, askingPrice, currency, fuelType, transmission, bodyType } = params

  const litres     = engineCc ? (engineCc / 1000).toFixed(1) : null
  const ccLabel    = engineCc ? `${engineCc}cc`              : null
  const litreLabel = litres   ? `${litres}L`                 : null
  const kwLabel    = powerKw  ? `${powerKw}kW`               : null

  const engineSpec = [
    litreLabel && ccLabel ? `${litreLabel} (${ccLabel})` : (litreLabel ?? ccLabel),
    kwLabel,
  ].filter(Boolean).join(' ')

  const vehicleDesc = [year, make, model, trim, engine || engineSpec].filter(Boolean).join(' ')
  const curr        = currency ?? 'EUR'

  const variantNote = engineSpec
    ? `\nEngine variant: **${engineSpec}** â€” focus issues on THIS specific engine/gearbox combination.`
    : ''

  const filterParts = [
    fuelType     ? `Fuel: **${fuelType}**`           : null,
    transmission ? `Gearbox: **${transmission}**`    : null,
    bodyType     ? `Body style: **${bodyType}**`     : null,
  ].filter(Boolean)

  const filterNote = filterParts.length > 0
    ? `\nVehicle spec: ${filterParts.join(' | ')} â€” tailor known issues to this configuration.`
    : ''

  const priceNote = askingPrice
    ? `\nAsking price: **${askingPrice.toLocaleString()} ${curr}**`
    : ''

  const priceInstruction = askingPrice
    ? `The buyer is paying ${askingPrice.toLocaleString()} ${curr}. Evaluate against the Serbia used-car market range.`
    : `No asking price provided. Provide a realistic Serbia market price range in EUR.`

  const kbContext = buildKbContext(kbIssues)
  const st = sectionTitles(params.locale)

  return `You are an expert automotive advisor helping a buyer in Serbia inspect a used car.

Vehicle: **${vehicleDesc}**${variantNote}${filterNote}${priceNote}${kbContext}

${priceInstruction}

Generate a practical pre-inspection guide based on real known issues, owner reports, and expert knowledge for this exact vehicle.

Rules:
- ${languageInstruction(params.locale)}
- Specific to this make/model/year AND engine variant where provided
- Use "commonly reported", "owners often note" language
- Focus on what a buyer physically checking this car should look for
- Include repair cost context for genuine financial risks
- Be concise and actionable
- Translate all user-facing JSON string values into the requested language: summary, priceContext.evaluationLabel, priceContext.summary, section titles, item titles, item descriptions, and disclaimer
- Do NOT translate JSON property names, enum values, ids, severity values, confidence values, or tag values

IMPORTANT â€” priceContext:
- Always populate priceContext â€” never omit it
- marketRangeFrom / marketRangeTo: realistic EUR integers for Serbia used-car market
- evaluation: "low" (below market / suspiciously cheap), "fair" (within range), "high" (above market)
- evaluationLabel: e.g. "Below market", "Fair market value", "Above market", "Estimate only"
- summary: 1-2 sentences comparing asking price (or absence) to Serbia market
- isEstimated: true
- avgPrice: integer EUR â€” midpoint of the realistic range
${askingPrice ? `- askingPrice: ${askingPrice}, currency: "${curr}"` : '- Omit askingPrice from priceContext'}

Respond ONLY with valid JSON. No markdown, no code fences.

{
  "vehicleKey": "${vehicleDesc}",
  "generatedAt": "${new Date().toISOString()}",
  "confidence": "high",
  "overallRiskLevel": "moderate",
  "summary": "1-2 sentence reliability overview for this specific variant",
  "priceContext": {
    ${askingPrice ? `"askingPrice": ${askingPrice}, "currency": "${curr}", ` : ''}"marketRangeFrom": 0, "marketRangeTo": 0, "avgPrice": 0,
    "evaluation": "fair", "evaluationLabel": "Fair market value",
    "summary": "...", "isEstimated": true, "source": "AI estimate", "confidence": "medium"
  },
  "sections": {
    "commonProblems":      { "id": "commonProblems",      "title": "${st.commonProblems}",      "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "highPriorityChecks":  { "id": "highPriorityChecks",  "title": "${st.highPriorityChecks}",  "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["HIGH_ATTENTION"] }] },
    "visualAttention":     { "id": "visualAttention",     "title": "${st.visualAttention}",     "items": [{ "title": "...", "description": "...", "severity": "medium", "tags": ["VISUAL_CHECK"]   }] },
    "mechanicalWatchouts": { "id": "mechanicalWatchouts", "title": "${st.mechanicalWatchouts}", "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["COMMON_ISSUE"]   }] },
    "testDriveFocus":      { "id": "testDriveFocus",      "title": "${st.testDriveFocus}",      "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["TEST_DRIVE"]     }] },
    "costAwareness":       { "id": "costAwareness",       "title": "${st.costAwareness}",       "items": [{ "title": "...", "description": "...", "severity": "high",   "tags": ["EXPENSIVE_RISK"] }] }
  },
  "disclaimer": "AI-generated guide. Price range is an estimated market reference, not live data. Verify with a qualified mechanic before purchase."
}

Generate 3-5 items per section. Be specific to the ${vehicleDesc}.`
}

function shouldLocalizeResearch(locale?: string): boolean {
  return normalizeLocale(locale) !== 'en'
}

function buildLocalizedReviewFallback(params: ResearchParams): VehicleResearchResult {
  return generateFallbackResult({
    make: params.make,
    model: params.model,
    year: params.year,
    engine: params.engine,
    trim: params.trim,
    locale: params.locale,
  })
}

function buildLocalizationPrompt(result: VehicleResearchResult, locale?: string): string {
  return `You are a professional automotive localization editor.

${languageInstruction(locale)}

Translate ONLY the user-facing string values in this vehicle research JSON:
- summary
- disclaimer
- priceContext.evaluationLabel
- priceContext.summary
- sections.*.title
- sections.*.items.*.title
- sections.*.items.*.description

Rules:
- Preserve the JSON structure exactly
- Preserve ids, property names, timestamps, numeric values, enum values, tags, severity values, confidence values, dataSource, fallbackReason, vehicleKey, and priceContext.evaluation
- If a user-facing string is already in the requested language, keep it natural and do not anglicize it
- Return ONLY valid JSON with the same structure

JSON:
${JSON.stringify(result)}`
}

// â”€â”€â”€ Price context builder â€” merges pricing-service result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildPriceContext(
  market: MarketPriceResult,
  askingPrice?: number,
  currency = 'EUR',
  locale = 'en',
): PriceContext {
  const { minPrice, maxPrice, avgPrice, confidence, source, listingCount, filtersUsed } = market

  const rangeStr = `â‚¬${minPrice.toLocaleString('de-DE')} â€“ â‚¬${maxPrice.toLocaleString('de-DE')}`

  let evaluation: PriceContext['evaluation']
  let evaluationLabel: string
  let summary: string
  const lang = normalizeLocale(locale)

  const fmtMoney = (value: number) => `€${value.toLocaleString('de-DE')}`
  const rangeForLocale = `${fmtMoney(minPrice)} - ${fmtMoney(maxPrice)}`
  const localizedMessages = {
    en: {
      estimate: 'Estimate only',
      low: 'Below market, investigate why',
      fair: 'Fair market value',
      high: 'Above market',
      summaryEstimate: `Estimated Serbia market range for this vehicle: ${rangeForLocale} (avg ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Asking price of ${fmtMoney(price)} is below the typical Serbia range of ${rangeForLocale}. Unusually low prices warrant extra scrutiny.`,
      summaryFair: (price: number) => `Asking price of ${fmtMoney(price)} sits within the typical Serbia range of ${rangeForLocale}.`,
      summaryHigh: (price: number) => `Asking price of ${fmtMoney(price)} is above the typical Serbia range of ${rangeForLocale}. Negotiate or verify premium features justify the premium.`,
    },
    sr: {
      estimate: 'Samo procena',
      low: 'Ispod tržišta - proveriti razlog',
      fair: 'U okviru tržišta',
      high: 'Iznad tržišta',
      summaryEstimate: `Procenjen tržišni raspon u Srbiji za ovo vozilo: ${rangeForLocale} (prosek ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Tražena cena od ${fmtMoney(price)} je ispod tipičnog raspona u Srbiji (${rangeForLocale}). Neuobičajeno niska cena zahteva dodatnu proveru.`,
      summaryFair: (price: number) => `Tražena cena od ${fmtMoney(price)} je u okviru tipičnog raspona u Srbiji (${rangeForLocale}).`,
      summaryHigh: (price: number) => `Tražena cena od ${fmtMoney(price)} je iznad tipičnog raspona u Srbiji (${rangeForLocale}). Pregovarajte ili proverite da li oprema i stanje opravdavaju razliku.`,
    },
    de: {
      estimate: 'Nur Schätzung',
      low: 'Unter Marktwert - Grund prüfen',
      fair: 'Marktgerechter Preis',
      high: 'Über Marktwert',
      summaryEstimate: `Geschätzte Marktspanne in Serbien für dieses Fahrzeug: ${rangeForLocale} (Durchschnitt ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Der Angebotspreis von ${fmtMoney(price)} liegt unter der typischen Spanne in Serbien (${rangeForLocale}). Ungewöhnlich niedrige Preise sollten genauer geprüft werden.`,
      summaryFair: (price: number) => `Der Angebotspreis von ${fmtMoney(price)} liegt innerhalb der typischen Spanne in Serbien (${rangeForLocale}).`,
      summaryHigh: (price: number) => `Der Angebotspreis von ${fmtMoney(price)} liegt über der typischen Spanne in Serbien (${rangeForLocale}). Verhandeln Sie oder prüfen Sie, ob Ausstattung und Zustand den Aufpreis rechtfertigen.`,
    },
    mk: {
      estimate: 'Само проценка',
      low: 'Под пазарот - проверете ја причината',
      fair: 'Во рамки на пазарот',
      high: 'Над пазарот',
      summaryEstimate: `Проценет пазарен опсег во Србија за ова возило: ${rangeForLocale} (просек ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Бараната цена од ${fmtMoney(price)} е под типичниот опсег во Србија (${rangeForLocale}). Невообичаено ниска цена бара дополнителна проверка.`,
      summaryFair: (price: number) => `Бараната цена од ${fmtMoney(price)} е во рамки на типичниот опсег во Србија (${rangeForLocale}).`,
      summaryHigh: (price: number) => `Бараната цена од ${fmtMoney(price)} е над типичниот опсег во Србија (${rangeForLocale}). Преговарајте или проверете дали опремата и состојбата ја оправдуваат разликата.`,
    },
    sq: {
      estimate: 'Vetëm vlerësim',
      low: 'Nën treg - kontrolloni arsyen',
      fair: 'Brenda tregut',
      high: 'Mbi treg',
      summaryEstimate: `Gama e vlerësuar e tregut në Serbi për këtë automjet: ${rangeForLocale} (mesatarja ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Çmimi i kërkuar prej ${fmtMoney(price)} është nën gamën tipike në Serbi (${rangeForLocale}). Çmimet shumë të ulëta kërkojnë kontroll shtesë.`,
      summaryFair: (price: number) => `Çmimi i kërkuar prej ${fmtMoney(price)} është brenda gamës tipike në Serbi (${rangeForLocale}).`,
      summaryHigh: (price: number) => `Çmimi i kërkuar prej ${fmtMoney(price)} është mbi gamën tipike në Serbi (${rangeForLocale}). Negocioni ose verifikoni nëse pajisjet dhe gjendja e justifikojnë diferencën.`,
    },
    bg: {
      estimate: 'Само оценка',
      low: 'Под пазара - проверете причината',
      fair: 'В рамките на пазара',
      high: 'Над пазара',
      summaryEstimate: `Оцененият пазарен диапазон в Сърбия за този автомобил е ${rangeForLocale} (средно ${fmtMoney(avgPrice)}).`,
      summaryLow: (price: number) => `Исканата цена от ${fmtMoney(price)} е под типичния диапазон в Сърбия (${rangeForLocale}). Необичайно ниската цена изисква допълнителна проверка.`,
      summaryFair: (price: number) => `Исканата цена от ${fmtMoney(price)} е в рамките на типичния диапазон в Сърбия (${rangeForLocale}).`,
      summaryHigh: (price: number) => `Исканата цена от ${fmtMoney(price)} е над типичния диапазон в Сърбия (${rangeForLocale}). Преговаряйте или проверете дали оборудването и състоянието оправдават разликата.`,
    },
  } as const
  const copy = localizedMessages[lang as keyof typeof localizedMessages] ?? localizedMessages.en
  const nextEvaluation =
    askingPrice == null
      ? 'fair'
      : askingPrice < minPrice * 0.9
        ? 'low'
        : askingPrice > maxPrice * 1.1
          ? 'high'
          : 'fair'
  const nextLabel =
    nextEvaluation === 'low'
      ? copy.low
      : nextEvaluation === 'high'
        ? copy.high
        : askingPrice == null
          ? copy.estimate
          : copy.fair
  const nextSummary =
    askingPrice == null
      ? copy.summaryEstimate
      : nextEvaluation === 'low'
        ? copy.summaryLow(askingPrice)
        : nextEvaluation === 'high'
          ? copy.summaryHigh(askingPrice)
          : copy.summaryFair(askingPrice)
  const nextFiltersMatched = filtersUsed
    ? Object.fromEntries(Object.entries(filtersUsed).filter(([, v]) => v != null))
    : undefined

  return {
    ...(askingPrice != null ? { askingPrice, currency } : {}),
    marketRangeFrom: minPrice,
    marketRangeTo: maxPrice,
    avgPrice,
    evaluation: nextEvaluation,
    evaluationLabel: nextLabel,
    summary: nextSummary,
    isEstimated: true,
    source,
    confidence,
    listingCount,
    filtersMatched: Object.keys(nextFiltersMatched ?? {}).length > 0 ? nextFiltersMatched : undefined,
    filtersRelaxed: listingCount != null && listingCount > 0 && nextFiltersMatched != null
      && Object.keys(nextFiltersMatched).length < 3 ? true : undefined,
  }
}

// â”€â”€â”€ KB vs AI deduplication â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Normalise a title string for loose comparison:
 * lowercase, strip punctuation, collapse whitespace.
 */
function normTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Remove AI section items whose title closely matches a KB issue title.
 * Uses substring containment both ways so "N47 timing chain failure" matches
 * "N47 Timing Chain Failure â€” CRITICAL" and vice versa.
 */
export function deduplicateAiSections(
  sections: VehicleResearchResult['sections'],
  kbIssues: MatchedIssue[],
): VehicleResearchResult['sections'] {
  if (kbIssues.length === 0) return sections
  const kbTitles = kbIssues.map(i => normTitle(i.title))

  function filterSection(section: ResearchSection): ResearchSection {
    const filtered = section.items.filter(item => {
      const t = normTitle(item.title)
      return !kbTitles.some(kb => kb.includes(t) || t.includes(kb))
    })
    return { ...section, items: filtered }
  }

  return {
    commonProblems:      filterSection(sections.commonProblems),
    highPriorityChecks:  filterSection(sections.highPriorityChecks),
    visualAttention:     filterSection(sections.visualAttention),
    mechanicalWatchouts: filterSection(sections.mechanicalWatchouts),
    testDriveFocus:      filterSection(sections.testDriveFocus),
    costAwareness:       filterSection(sections.costAwareness),
  }
}

// â”€â”€â”€ Anthropic API caller â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function severityFromKb(issue: MatchedIssue): ResearchIssue['severity'] {
  if (issue.severity === 'critical' || issue.severity === 'major') return 'high'
  if (issue.severity === 'minor') return 'medium'
  return 'low'
}

function tagsFromKb(issue: MatchedIssue, primaryTag: ResearchTagType): ResearchTagType[] {
  const tags = new Set<ResearchTagType>([primaryTag])
  if (issue.severity === 'critical' || issue.severity === 'major') tags.add('HIGH_ATTENTION')
  if (issue.frequency === 'widespread' || issue.frequency === 'common') tags.add('COMMON_ISSUE')
  if (issue.category === 'body' || issue.category === 'interior' || issue.category === 'rust' || issue.category === 'safety') tags.add('VISUAL_CHECK')
  if (issue.estimatedRepairCost && issue.estimatedRepairCost.max >= 1000) tags.add('EXPENSIVE_RISK')
  return Array.from(tags)
}

function repairCostText(issue: MatchedIssue): string {
  if (!issue.estimatedRepairCost) return ''
  const { min, max, currency } = issue.estimatedRepairCost
  return ` Estimated repair exposure: ${min.toLocaleString('de-DE')}-${max.toLocaleString('de-DE')} ${currency}.`
}

function issueToResearchIssue(issue: MatchedIssue, description: string, primaryTag: ResearchTagType): ResearchIssue {
  const notes = issue.applicabilityNotes ? ` ${issue.applicabilityNotes}` : ''
  return {
    title: issue.title,
    description: `${description}${repairCostText(issue)}${notes}`.trim(),
    severity: severityFromKb(issue),
    tags: tagsFromKb(issue, primaryTag),
  }
}

function emptySections(locale?: string): VehicleResearchResult['sections'] {
  const st = sectionTitles(locale)
  return {
    commonProblems:      { id: 'commonProblems',      title: st.commonProblems,      items: [] },
    highPriorityChecks:  { id: 'highPriorityChecks',  title: st.highPriorityChecks,  items: [] },
    visualAttention:     { id: 'visualAttention',     title: st.visualAttention,     items: [] },
    mechanicalWatchouts: { id: 'mechanicalWatchouts', title: st.mechanicalWatchouts, items: [] },
    testDriveFocus:      { id: 'testDriveFocus',      title: st.testDriveFocus,      items: [] },
    costAwareness:       { id: 'costAwareness',       title: st.costAwareness,       items: [] },
  }
}

function takeIssues(issues: MatchedIssue[], predicate: (issue: MatchedIssue) => boolean, limit: number): MatchedIssue[] {
  return issues.filter(predicate).slice(0, limit)
}

export function buildKbResearchSections(kbIssues: MatchedIssue[], locale?: string): VehicleResearchResult['sections'] {
  const sections = emptySections(locale)
  if (kbIssues.length === 0) return sections

  const common = takeIssues(kbIssues, issue =>
    issue.frequency === 'widespread' || issue.frequency === 'common' || issue.severity === 'critical',
  5)
  const priority = takeIssues(kbIssues, issue =>
    issue.severity === 'critical' || issue.severity === 'major',
  5)
  const visual = takeIssues(kbIssues, issue =>
    issue.category === 'body' || issue.category === 'interior' || issue.category === 'rust' || issue.category === 'safety',
  5)
  const mechanical = takeIssues(kbIssues, issue =>
    issue.category === 'mechanical' || issue.category === 'electrical' || issue.category === 'wear',
  5)
  const testDrive = takeIssues(kbIssues, issue =>
    issue.category === 'mechanical' || issue.transmission != null || issue.drivetrain != null,
  5)
  const cost = [...kbIssues]
    .filter(issue => issue.estimatedRepairCost)
    .sort((a, b) => (b.estimatedRepairCost?.max ?? 0) - (a.estimatedRepairCost?.max ?? 0))
    .slice(0, 5)

  sections.commonProblems.items = common.map(issue => issueToResearchIssue(issue, issue.explanation, 'COMMON_ISSUE'))
  sections.highPriorityChecks.items = priority.map(issue => issueToResearchIssue(issue, issue.inspectionAdvice, 'HIGH_ATTENTION'))
  sections.visualAttention.items = visual.map(issue => issueToResearchIssue(issue, issue.inspectionAdvice, 'VISUAL_CHECK'))
  sections.mechanicalWatchouts.items = mechanical.map(issue => issueToResearchIssue(issue, issue.explanation, 'COMMON_ISSUE'))
  sections.testDriveFocus.items = testDrive.map(issue => issueToResearchIssue(issue, issue.inspectionAdvice, 'TEST_DRIVE'))
  sections.costAwareness.items = cost.map(issue => issueToResearchIssue(issue, issue.inspectionAdvice, 'EXPENSIVE_RISK'))

  return sections
}

function mergeKbSections(
  sections: VehicleResearchResult['sections'],
  kbIssues: MatchedIssue[],
  locale?: string,
): VehicleResearchResult['sections'] {
  if (kbIssues.length === 0) return sections
  const kbSections = buildKbResearchSections(kbIssues, locale)
  const aiSections = deduplicateAiSections(sections, kbIssues)

  function mergeSection(key: keyof VehicleResearchResult['sections']): ResearchSection {
    const seen = new Set<string>()
    const items = [...kbSections[key].items, ...aiSections[key].items]
      .filter(item => {
        const normalized = normTitle(item.title)
        if (seen.has(normalized)) return false
        seen.add(normalized)
        return true
      })
      .slice(0, 6)

    return {
      ...aiSections[key],
      title: aiSections[key]?.title ?? kbSections[key].title,
      items,
    }
  }

  return {
    commonProblems:      mergeSection('commonProblems'),
    highPriorityChecks:  mergeSection('highPriorityChecks'),
    visualAttention:     mergeSection('visualAttention'),
    mechanicalWatchouts: mergeSection('mechanicalWatchouts'),
    testDriveFocus:      mergeSection('testDriveFocus'),
    costAwareness:       mergeSection('costAwareness'),
  }
}

function buildVehicleKey(params: ResearchParams): string {
  return [
    params.year,
    params.make,
    params.model,
    params.trim,
    params.engine,
    params.engineCc ? `${(params.engineCc / 1000).toFixed(1)}L` : null,
    params.fuelType,
    params.transmission,
  ].filter(Boolean).join(' ')
}

function buildKbFallbackResult(params: ResearchParams, kbIssues: MatchedIssue[]): VehicleResearchResult {
  const vehicleKey = buildVehicleKey(params)
  const top = kbIssues[0]
  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    dataSource: 'knowledge_base',
    confidence: kbIssues.length >= 3 ? 'medium' : 'low',
    overallRiskLevel: kbIssues.some(issue => issue.severity === 'critical') ? 'high' : 'moderate',
    summary: top
      ? `${vehicleKey}: live AI enrichment is unavailable, so this guide uses the matched vehicle knowledge base. The highest-priority known item is "${top.title}".`
      : `${vehicleKey}: live AI enrichment is unavailable and no model-specific knowledge base entries were matched.`,
    sections: buildKbResearchSections(kbIssues, params.locale),
    disclaimer: 'Live AI enrichment was unavailable. This guide uses deterministic vehicle-specific knowledge base matches and should still be verified by a qualified mechanic before purchase.',
  }
}

async function callAnthropic(
  apiKey: string,
  prompt: string,
  timeoutMs: number,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timer      = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Anthropic ${response.status}: ${text.slice(0, 200)}`)
    }

    const json    = await response.json()
    const raw: string = json.content?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed  = JSON.parse(cleaned) as Record<string, unknown>
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

async function generateResearchResult(
  apiKey: string,
  params: ResearchParams,
  timeoutMs: number,
  kbIssues: MatchedIssue[] = [],
): Promise<VehicleResearchResult> {
  const parsed = await callAnthropic(apiKey, buildPrompt(params, kbIssues), timeoutMs) as unknown as VehicleResearchResult
    // Warn if sections are incomplete but do not throw â€” a partial AI result is
    // better than falling back to the English-only static knowledge base.
  if (!parsed.sections || typeof parsed.sections !== 'object') {
    throw new Error('Anthropic response missing sections object entirely')
  }
  if (!parsed.sections.commonProblems) {
    console.warn('[research] Anthropic response missing commonProblems section â€” using partial result')
  }
  return parsed
}

async function localizeResearchResult(
  apiKey: string,
  result: VehicleResearchResult,
  locale?: string,
): Promise<VehicleResearchResult> {
  if (!shouldLocalizeResearch(locale)) return result

  const localized = await callAnthropic(apiKey, buildLocalizationPrompt(result, locale), 12000) as unknown as VehicleResearchResult
  if (!localized.sections || typeof localized.sections !== 'object') {
    throw new Error('Localized research response missing sections object')
  }

  return {
    ...result,
    summary: localized.summary ?? result.summary,
    disclaimer: localized.disclaimer ?? result.disclaimer,
    priceContext: result.priceContext
      ? {
          ...result.priceContext,
          evaluationLabel: localized.priceContext?.evaluationLabel ?? result.priceContext.evaluationLabel,
          summary: localized.priceContext?.summary ?? result.priceContext.summary,
        }
      : localized.priceContext,
    sections: {
      commonProblems:      localized.sections.commonProblems      ?? result.sections.commonProblems,
      highPriorityChecks:  localized.sections.highPriorityChecks  ?? result.sections.highPriorityChecks,
      visualAttention:     localized.sections.visualAttention     ?? result.sections.visualAttention,
      mechanicalWatchouts: localized.sections.mechanicalWatchouts ?? result.sections.mechanicalWatchouts,
      testDriveFocus:      localized.sections.testDriveFocus      ?? result.sections.testDriveFocus,
      costAwareness:       localized.sections.costAwareness       ?? result.sections.costAwareness,
    },
  }
}

// â”€â”€â”€ Service â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export class VehicleResearchService {
  constructor(private readonly anthropicApiKey: string) {}

  async research(params: ResearchParams): Promise<ResearchOutput> {
    // â”€â”€ KB matching (synchronous, fast) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let kbIssues: MatchedIssue[] = []
    try {
      const identity = normalizeVehicle(params)
      kbIssues = matchIssues(identity, allIssues, 12)
      console.log(`[research] KB matched ${kbIssues.length} issues for ${identity.make} ${identity.model} ${identity.generation ?? identity.yearFrom}`)
    } catch (err) {
      console.warn('[research] KB matching failed â€” continuing without KB context:', err)
    }

    // â”€â”€ Run research + pricing in parallel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [researchOutcome, pricingOutcome] = await Promise.allSettled([
      this.anthropicApiKey
        ? this.callWithRetry(params, kbIssues)
        : Promise.reject(new Error('No API key')),
      pricingService.getMarketPrice({
        make:         params.make,
        model:        params.model,
        year:         params.year,
        engineCc:     params.engineCc,
        powerKw:      params.powerKw,
        trim:         params.trim,
        askingPrice:  params.askingPrice,
        currency:     params.currency,
        fuelType:     params.fuelType,
        transmission: params.transmission,
        bodyType:     params.bodyType,
        mileage:      params.mileage,
      }),
    ])

    // â”€â”€ Build final result â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let base: VehicleResearchResult
    let limitedMode = false
    const aiConfigured = Boolean(this.anthropicApiKey)

    if (researchOutcome.status === 'fulfilled') {
      base = { ...researchOutcome.value, dataSource: 'ai_live', fallbackReason: undefined }
      // KB is first-class output: prepend deterministic vehicle-specific issues, then keep non-duplicated AI enrichment.
      if (kbIssues.length > 0 && base.sections) {
        base = { ...base, sections: mergeKbSections(base.sections, kbIssues, params.locale) }
      }
      console.log('[research] Anthropic OK')
    } else {
      console.warn('[research] AI failed â€” using knowledge base:', researchOutcome.reason)
      if (kbIssues.length > 0) {
        base = {
          ...buildKbFallbackResult(params, kbIssues),
          fallbackReason: fallbackReasonFor(aiConfigured),
        }
      } else {
        base = {
          ...generateFallbackResult(params),
          dataSource: 'generic_fallback',
          fallbackReason: 'no_model_data',
        }
        limitedMode = true
      }
    }

    // Pricing service overrides / enriches priceContext
    if (pricingOutcome.status === 'fulfilled') {
      base.priceContext = buildPriceContext(
        pricingOutcome.value,
        params.askingPrice,
        params.currency,
        params.locale,
      )
      console.log('[pricing] Context set from pricing service')
    } else if (!base.priceContext) {
      console.warn('[pricing] No price context available')
    }

    if (shouldLocalizeResearch(params.locale)) {
      if (this.anthropicApiKey) {
        try {
          base = await localizeResearchResult(this.anthropicApiKey, base, params.locale)
        } catch (err) {
          console.warn('[research] Final localization pass failed â€” using localized generic fallback:', err)
          base = {
            ...buildLocalizedReviewFallback(params),
            priceContext: base.priceContext,
          }
        }
      } else {
        // Without a live localization provider, prefer a fully localized generic
        // guide over leaking mixed-language KB prose into non-English results.
        base = {
          ...buildLocalizedReviewFallback(params),
          priceContext: base.priceContext,
        }
      }
    }

    return { ...base, limitedMode, kbIssues, kbMatchCount: kbIssues.length }
  }

  private async callWithRetry(params: ResearchParams, kbIssues: MatchedIssue[] = []): Promise<VehicleResearchResult> {
    try {
      return await generateResearchResult(this.anthropicApiKey, params, 12000, kbIssues)
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
      console.warn(`[research] Attempt 1 failed (${isTimeout ? 'timeout' : 'error'}) â€” retrying with extended timeout`)
    }
    // Second attempt: longer timeout to handle slow model responses
    return await generateResearchResult(this.anthropicApiKey, params, 18000, kbIssues)
  }
}

// Singleton
export const vehicleResearchService = new VehicleResearchService(
  process.env.ANTHROPIC_API_KEY ?? '',
)

