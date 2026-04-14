# Data Architecture — Vehicle Intelligence System

## Overview

The vehicle intelligence system is a **hybrid AI + structured** architecture. Structured data is the backbone; AI provides summaries, gap-filling, and contextual enrichment. Neither layer is optional — they complement each other.

```
User Input (make/model/year/fuel/transmission/mileage/locale)
         │
         ▼
┌─────────────────────────────────┐
│  Layer 1: Vehicle Normalization │  src/lib/vehicle/normalize.ts
│  Canonical identity object      │
└────────────────┬────────────────┘
                 │
         ┌───────┴───────┐
         ▼               ▼
┌─────────────────┐  ┌──────────────────────┐
│ Layer 2:        │  │ Layer 5: Visual AI   │
│ Structured KB   │  │ GPT-4o photo analysis│
│ /data/vehicle-  │  │ → structured findings│
│  issues/        │  └──────────┬───────────┘
└────────┬────────┘             │
         ▼                      │
┌─────────────────────────────┐ │
│ Layer 3: Matching Engine    │ │
│ src/lib/vehicle/matcher.ts  │ │
│ Deterministic issue ranking │ │
└────────┬────────────────────┘ │
         │                      │
         ▼                      ▼
┌─────────────────────────────────────┐
│ Layer 4: AI Support                 │
│ Anthropic Claude — summarize,       │
│ fill gaps, add context, translate   │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌────────────────┐  ┌───────────────────────┐
│ Layer 6:       │  │ Layer 7: Report        │
│ Pricing Engine │  │ Intelligence Engine    │
│ Region-aware   │  │ Sectioned output       │
└────────┬───────┘  └──────────┬────────────┘
         └──────────┬──────────┘
                    ▼
           Final Inspection Report
```

## Data Flow

### Input → Normalization
Raw form data (strings, optional fields) → `VehicleIdentity` canonical object with nulls for missing fields.

### VehicleIdentity → Matcher
Exact match → partial match → generation match → make-only match. Returns ranked `MatchedIssue[]`.

### Matched Issues → AI Support
AI receives the structured issue list and produces natural-language summaries per category, not new facts.

### Photos → Visual AI
Each photo analyzed by GPT-4o with angle-specific prompts. Output: `{signal, severity, detail, confidence}` per photo.

### All Layers → Report Engine
Seven scoring dimensions (existing `scoring.logic.ts`) + knowledge base issues + pricing + visual findings → final report sections.

## Storage

| Layer | Location | Format |
|-------|----------|--------|
| Knowledge base | `/data/vehicle-issues/` | TypeScript `const` arrays |
| Normalization | `src/lib/vehicle/normalize.ts` | Pure functions |
| Matcher | `src/lib/vehicle/matcher.ts` | Pure functions |
| AI calls | `src/modules/research/research.service.ts` | Existing |
| Pricing | `src/modules/pricing/` | Existing |
| Scoring | `src/modules/scoring/scoring.logic.ts` | Existing |

## Key Principles

1. **Structured data wins conflicts** — if KB says "VW 2.0 TDI timing chain fails", AI cannot override this.
2. **AI translates and enriches** — AI writes the prose, KB writes the facts.
3. **Every issue has confidence** — `high` = documented recall/TSB, `medium` = community consensus, `low` = anecdotal.
4. **No breaking changes** — all new code is additive. Existing inspection flow, scoring, auth, camera remain untouched.
5. **Locale-aware output** — matching is locale-independent; prose generation is locale-specific.
