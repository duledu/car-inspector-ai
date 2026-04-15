// =============================================================================
// Vehicle Research Service
// AI provider: Anthropic Claude (primary) → knowledge base fallback
// Pricing: pricing.service runs in parallel, result merged into priceContext
// =============================================================================

import type { VehicleResearchResult, PriceContext, ResearchSection } from '@/types'
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

// ─── Prompt builder ───────────────────────────────────────────────────────────

function normalizeLocale(locale?: string): string {
  return (locale ?? 'en').toLowerCase().split('-')[0]
}

function languageInstruction(locale?: string): string {
  switch (normalizeLocale(locale)) {
    case 'sr':
      return 'Respond in Serbian (Latin script). Use natural, professional automotive terminology used in Serbia. Keep all JSON keys exactly as specified in English.'
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
  // Emit all KB issues (not just 8) so AI cannot "accidentally" add any of them back.
  // Format is compact (title + category) to save tokens while giving AI a clear exclusion list.
  const lines = kbIssues
    .map(i => `- [${i.severity.toUpperCase()}/${i.category}] ${i.title}`)
    .join('\n')
  return `\n\nKNOWN ISSUES (already covered — NEVER include these titles or their substance in your output sections):\n${lines}`
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
    ? `\nEngine variant: **${engineSpec}** — focus issues on THIS specific engine/gearbox combination.`
    : ''

  const filterParts = [
    fuelType     ? `Fuel: **${fuelType}**`           : null,
    transmission ? `Gearbox: **${transmission}**`    : null,
    bodyType     ? `Body style: **${bodyType}**`     : null,
  ].filter(Boolean)

  const filterNote = filterParts.length > 0
    ? `\nVehicle spec: ${filterParts.join(' | ')} — tailor known issues to this configuration.`
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

IMPORTANT — priceContext:
- Always populate priceContext — never omit it
- marketRangeFrom / marketRangeTo: realistic EUR integers for Serbia used-car market
- evaluation: "low" (below market / suspiciously cheap), "fair" (within range), "high" (above market)
- evaluationLabel: e.g. "Below market", "Fair market value", "Above market", "Estimate only"
- summary: 1-2 sentences comparing asking price (or absence) to Serbia market
- isEstimated: true
- avgPrice: integer EUR — midpoint of the realistic range
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

// ─── Price context builder — merges pricing-service result ────────────────────

function buildPriceContext(
  market: MarketPriceResult,
  askingPrice?: number,
  currency = 'EUR',
  locale = 'en',
): PriceContext {
  const { minPrice, maxPrice, avgPrice, confidence, source, listingCount, filtersUsed } = market

  const rangeStr = `€${minPrice.toLocaleString('de-DE')} – €${maxPrice.toLocaleString('de-DE')}`

  let evaluation: PriceContext['evaluation']
  let evaluationLabel: string
  let summary: string
  const lang = normalizeLocale(locale)

  if (askingPrice == null) {
    evaluation      = 'fair'
    evaluationLabel = lang === 'sr' ? 'Samo procena' : lang === 'mk' ? 'Само проценка' : lang === 'de' ? 'Nur Schätzung' : lang === 'sq' ? 'Vetëm vlerësim' : 'Estimate only'
    summary = `Estimated Serbia market range for this vehicle: ${rangeStr} (avg €${avgPrice.toLocaleString('de-DE')}).`
  } else if (askingPrice < minPrice * 0.9) {
    evaluation      = 'low'
    evaluationLabel = 'Below market, investigate why'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} is below the typical Serbia range of ${rangeStr}. Unusually low prices warrant extra scrutiny.`
  } else if (askingPrice > maxPrice * 1.1) {
    evaluation      = 'high'
    evaluationLabel = 'Above market'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} is above the typical Serbia range of ${rangeStr}. Negotiate or verify premium features justify the premium.`
  } else {
    evaluation      = 'fair'
    evaluationLabel = 'Fair market value'
    summary = `Asking price of €${askingPrice.toLocaleString('de-DE')} sits within the typical Serbia range of ${rangeStr}.`
  }

  if (lang !== 'en') {
    const localizedLabels = {
      estimate: lang === 'sr' ? 'Samo procena' : lang === 'mk' ? 'Само проценка' : lang === 'de' ? 'Nur Schätzung' : 'Vetëm vlerësim',
      low:      lang === 'sr' ? 'Ispod tržišta - proveriti razlog' : lang === 'mk' ? 'Под пазарот - проверете ја причината' : lang === 'de' ? 'Unter Marktwert - Grund prüfen' : 'Nën treg - kontrolloni arsyen',
      fair:     lang === 'sr' ? 'U okviru tržišta' : lang === 'mk' ? 'Во рамки на пазарот' : lang === 'de' ? 'Marktgerechter Preis' : 'Brenda tregut',
      high:     lang === 'sr' ? 'Iznad tržišta' : lang === 'mk' ? 'Над пазарот' : lang === 'de' ? 'Über Marktwert' : 'Mbi treg',
    }

    if (askingPrice == null) {
      evaluationLabel = localizedLabels.estimate
      summary = lang === 'sr'
        ? `Procenjen tržišni raspon u Srbiji za ovo vozilo: ${rangeStr} (prosek EUR ${avgPrice.toLocaleString('de-DE')}).`
        : lang === 'mk'
          ? `Проценет пазарен опсег во Србија за ова возило: ${rangeStr} (просек EUR ${avgPrice.toLocaleString('de-DE')}).`
          : lang === 'de'
            ? `Geschätzte Marktspanne in Serbien für dieses Fahrzeug: ${rangeStr} (Durchschnitt EUR ${avgPrice.toLocaleString('de-DE')}).`
            : `Gama e vlerësuar e tregut në Serbi për këtë automjet: ${rangeStr} (mesatarja EUR ${avgPrice.toLocaleString('de-DE')}).`
    } else if (evaluation === 'low') {
      evaluationLabel = localizedLabels.low
      summary = lang === 'sr'
        ? `Tražena cena od EUR ${askingPrice.toLocaleString('de-DE')} je ispod tipičnog raspona u Srbiji (${rangeStr}). Neuobičajeno niska cena zahteva dodatnu proveru.`
        : lang === 'mk'
          ? `Бараната цена од EUR ${askingPrice.toLocaleString('de-DE')} е под типичниот опсег во Србија (${rangeStr}). Невообичаено ниска цена бара дополнителна проверка.`
          : lang === 'de'
            ? `Der Angebotspreis von EUR ${askingPrice.toLocaleString('de-DE')} liegt unter der typischen Spanne in Serbien (${rangeStr}). Ungewöhnlich niedrige Preise sollten genauer geprüft werden.`
            : `Çmimi i kërkuar prej EUR ${askingPrice.toLocaleString('de-DE')} është nën gamën tipike në Serbi (${rangeStr}). Çmimet shumë të ulëta kërkojnë kontroll shtesë.`
    } else if (evaluation === 'high') {
      evaluationLabel = localizedLabels.high
      summary = lang === 'sr'
        ? `Tražena cena od EUR ${askingPrice.toLocaleString('de-DE')} je iznad tipičnog raspona u Srbiji (${rangeStr}). Pregovarajte ili proverite da li oprema i stanje opravdavaju razliku.`
        : lang === 'mk'
          ? `Бараната цена од EUR ${askingPrice.toLocaleString('de-DE')} е над типичниот опсег во Србија (${rangeStr}). Преговарајте или проверете дали опремата и состојбата ја оправдуваат разликата.`
          : lang === 'de'
            ? `Der Angebotspreis von EUR ${askingPrice.toLocaleString('de-DE')} liegt über der typischen Spanne in Serbien (${rangeStr}). Verhandeln Sie oder prüfen Sie, ob Ausstattung und Zustand den Aufpreis rechtfertigen.`
            : `Çmimi i kërkuar prej EUR ${askingPrice.toLocaleString('de-DE')} është mbi gamën tipike në Serbi (${rangeStr}). Negocioni ose verifikoni nëse pajisjet dhe gjendja e justifikojnë diferencën.`
    } else {
      evaluationLabel = localizedLabels.fair
      summary = lang === 'sr'
        ? `Tražena cena od EUR ${askingPrice.toLocaleString('de-DE')} je u okviru tipičnog raspona u Srbiji (${rangeStr}).`
        : lang === 'mk'
          ? `Бараната цена од EUR ${askingPrice.toLocaleString('de-DE')} е во рамки на типичниот опсег во Србија (${rangeStr}).`
          : lang === 'de'
            ? `Der Angebotspreis von EUR ${askingPrice.toLocaleString('de-DE')} liegt innerhalb der typischen Spanne in Serbien (${rangeStr}).`
            : `Çmimi i kërkuar prej EUR ${askingPrice.toLocaleString('de-DE')} është brenda gamës tipike në Serbi (${rangeStr}).`
    }
  }

  const filtersMatched = filtersUsed
    ? Object.fromEntries(Object.entries(filtersUsed).filter(([, v]) => v != null))
    : undefined

  return {
    ...(askingPrice != null ? { askingPrice, currency } : {}),
    marketRangeFrom: minPrice,
    marketRangeTo:   maxPrice,
    avgPrice,
    evaluation,
    evaluationLabel,
    summary,
    isEstimated: true,
    source,
    confidence,
    listingCount,
    filtersMatched:  Object.keys(filtersMatched ?? {}).length > 0 ? filtersMatched : undefined,
    filtersRelaxed:  listingCount != null && listingCount > 0 && filtersMatched != null
                       && Object.keys(filtersMatched).length < 3 ? true : undefined,
  }
}

// ─── KB vs AI deduplication ──────────────────────────────────────────────────

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
 * "N47 Timing Chain Failure — CRITICAL" and vice versa.
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

// ─── Anthropic API caller ─────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  params: ResearchParams,
  timeoutMs: number,
  kbIssues: MatchedIssue[] = [],
): Promise<VehicleResearchResult> {
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
        messages: [{ role: 'user', content: buildPrompt(params, kbIssues) }],
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`Anthropic ${response.status}: ${text.slice(0, 200)}`)
    }

    const json    = await response.json()
    const raw: string = json.content?.[0]?.text ?? ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed  = JSON.parse(cleaned) as VehicleResearchResult
    // Warn if sections are incomplete but do not throw — a partial AI result is
    // better than falling back to the English-only static knowledge base.
    if (!parsed.sections || typeof parsed.sections !== 'object') {
      throw new Error('Anthropic response missing sections object entirely')
    }
    if (!parsed.sections.commonProblems) {
      console.warn('[research] Anthropic response missing commonProblems section — using partial result')
    }
    return parsed
  } finally {
    clearTimeout(timer)
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class VehicleResearchService {
  constructor(private readonly anthropicApiKey: string) {}

  async research(params: ResearchParams): Promise<ResearchOutput> {
    // ── KB matching (synchronous, fast) ──────────────────────────────────────
    let kbIssues: MatchedIssue[] = []
    try {
      const identity = normalizeVehicle(params)
      kbIssues = matchIssues(identity, allIssues, 12)
      console.log(`[research] KB matched ${kbIssues.length} issues for ${identity.make} ${identity.model} ${identity.generation ?? identity.yearFrom}`)
    } catch (err) {
      console.warn('[research] KB matching failed — continuing without KB context:', err)
    }

    // ── Run research + pricing in parallel ──────────────────────────────────
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

    // ── Build final result ───────────────────────────────────────────────────
    let base: VehicleResearchResult
    let limitedMode = false

    if (researchOutcome.status === 'fulfilled') {
      base = researchOutcome.value
      // Remove AI items that duplicate KB issues (belt-and-suspenders — prompt already instructs AI not to repeat them)
      if (kbIssues.length > 0 && base.sections) {
        base = { ...base, sections: deduplicateAiSections(base.sections, kbIssues) }
      }
      console.log('[research] Anthropic OK')
    } else {
      console.warn('[research] AI failed — using knowledge base:', researchOutcome.reason)
      base        = generateFallbackResult(params)
      limitedMode = true
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

    return { ...base, limitedMode, kbIssues, kbMatchCount: kbIssues.length }
  }

  private async callWithRetry(params: ResearchParams, kbIssues: MatchedIssue[] = []): Promise<VehicleResearchResult> {
    try {
      return await callAnthropic(this.anthropicApiKey, params, 12000, kbIssues)
    } catch (err) {
      const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'))
      console.warn(`[research] Attempt 1 failed (${isTimeout ? 'timeout' : 'error'}) — retrying with extended timeout`)
    }
    // Second attempt: longer timeout to handle slow model responses
    return await callAnthropic(this.anthropicApiKey, params, 18000, kbIssues)
  }
}

// Singleton
export const vehicleResearchService = new VehicleResearchService(
  process.env.ANTHROPIC_API_KEY ?? '',
)
