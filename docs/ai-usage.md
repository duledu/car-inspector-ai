# AI Usage

## Philosophy

AI is a support layer, not the primary source of facts. The structured knowledge base provides deterministic, version-controlled truth. AI summarizes, translates, fills gaps, and writes prose.

```
Structured KB  →  FACTS     (deterministic, version-controlled)
AI             →  PROSE     (dynamic, locale-aware, contextual)
```

## Models

| Task | Model | Reason |
|------|-------|--------|
| Vehicle research summary | Anthropic Claude (claude-sonnet-4-6) | Best at long-form structured JSON, multilingual |
| Photo analysis | OpenAI GPT-4o | Best vision model for damage detection |
| Gap-filling issues | Anthropic Claude | Falls back to AI when KB has no match |

## Anthropic Claude — Research

**Location:** `src/modules/research/research.service.ts`

**When used:** After the knowledge base matcher runs. Claude receives:
- The normalized `VehicleIdentity`
- The top matched issues from KB (so it doesn't repeat them)
- A JSON output schema with 6 sections

**What it produces:**
```typescript
interface VehicleResearchResult {
  commonProblems: string[]      // issues NOT already in KB match
  weakPoints:     string[]      // design/engineering weak points
  whatToCheck:    string[]      // inspection checklist additions
  ownershipRisk:  string        // prose summary
  positives:      string[]      // reliability strengths
  priceContext:   string        // market context prose
}
```

**Key constraint:** Prompt instructs Claude to skip issues already covered by the KB match. This avoids duplication between structured and AI layers.

**Fallback:** If Claude fails (rate limit, timeout, API error), `generateFallbackResult()` in `fallback.knowledge.ts` returns a generic response. The inspection can still complete.

## OpenAI GPT-4o — Photo Analysis

**Location:** `src/app/api/inspection/analyze-photo/route.ts`

**When used:** For each uploaded photo during inspection.

**Input:** Base64-encoded image + angle label (exterior_front, engine_bay, interior, etc.)

**Output:**
```typescript
interface PhotoFinding {
  signal:     string   // "rust", "dent", "oil_leak", "cracked_dashboard"
  severity:   'none' | 'minor' | 'moderate' | 'severe'
  detail:     string   // human-readable description
  confidence: number   // 0–1
}
```

**Angle-specific prompts:** Each angle has a prompt optimized for what defects are visible from that position (e.g., engine bay prompt focuses on leaks, corrosion, modification signs).

## AI Constraints

1. **No hallucinated prices** — AI is not asked to quote repair costs. Costs come from the structured KB `estimatedRepairCost` fields.
2. **No hallucinated part numbers** — AI is not asked to cite TSBs or recall numbers. Recall citations come from KB `source` fields.
3. **Locale in prompt** — All Claude calls include a language instruction. AI responds in the user's language.
4. **JSON output enforced** — Claude prompts use `response_format` or explicit JSON schema instructions. Malformed JSON triggers fallback.
5. **Temperature 0.2** — Low temperature for research tasks. Reduces hallucination on factual queries.

## Token Budget

| Call | Approx tokens | Monthly @ 100 inspections/day |
|------|--------------|-------------------------------|
| Claude research | ~3,000 in / ~1,500 out | ~135M tokens |
| GPT-4o per photo | ~800 in / ~200 out | ~30M tokens (3 photos avg) |

Consider caching research results by `VehicleIdentity` hash for 7 days to reduce API costs on popular vehicle trims.

## Error Handling

All AI calls are wrapped in try/catch. Failures are logged but never crash the inspection:
- Research fail → fallback knowledge base result
- Photo analysis fail → finding with `signal: 'analysis_failed'`, `severity: 'none'`

Never show raw AI error messages to users.
