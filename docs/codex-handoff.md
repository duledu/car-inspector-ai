# Codex Handoff — Vehicle Intelligence System

This document is a self-contained implementation guide for the vehicle intelligence system. A developer (or AI coding assistant) reading this should be able to implement the entire system without access to prior conversation history.

## What exists today

| Component | Location | Status |
|-----------|----------|--------|
| Vehicle research | `src/modules/research/research.service.ts` | Working — AI-primary |
| Pricing service | `src/modules/pricing/pricing.service.ts` | Working |
| Scoring engine | `src/modules/scoring/scoring.logic.ts` | Working — deterministic |
| Photo analysis | `src/app/api/inspection/analyze-photo/route.ts` | Working — GPT-4o |
| Inspection checklist | 41 items, 6 categories | Working |
| Auth (Google OAuth) | `src/app/api/auth/google/` | Working |
| Camera | `src/hooks/useCamera.ts` | Working |

## What needs to be built

### 1. Schema file

**File:** `src/lib/vehicle/types.ts`

Define all types: `BodyType`, `FuelType`, `Transmission`, `Drivetrain`, `VehicleIdentity`, `VehicleIssue`, `IssueCategory`, `MatchedIssue`.

See `docs/vehicle-normalization.md` and `docs/knowledge-base.md` for full schemas.

### 2. Vehicle normalization

**File:** `src/lib/vehicle/normalize.ts`

```typescript
export function normalizeVehicle(params: ResearchParams): VehicleIdentity
```

Maps raw `ResearchParams` (from existing research service) to canonical `VehicleIdentity`. Rules:
- Lowercase and trim all strings
- Map make aliases: VW → volkswagen, Merc → mercedes-benz
- Extract generation from model string OR year range
- Map engine codes to engine families

`ResearchParams` is defined in `src/modules/research/research.service.ts` — import from there.

### 3. Knowledge base schema

**File:** `data/vehicle-issues/_schema.ts`

Just the TypeScript type exports. All issue files import from here.

### 4. Knowledge base data

**Directory:** `data/vehicle-issues/`

Start with highest-volume vehicles in Balkan markets (in priority order):
1. `volkswagen-golf.ts` — Golf Mk5/6/7/7.5/8
2. `volkswagen-passat.ts` — B6/B7/B8
3. `bmw-3series.ts` — E90/F30/G20
4. `audi-a4.ts` — B7/B8/B9
5. `mercedes-c-class.ts` — W203/W204/W205
6. `ford-focus.ts` — Mk2/Mk3
7. `opel-astra.ts` — H/J/K

Each file: `export const issues: VehicleIssue[] = [...]`

**Index file:** `data/vehicle-issues/index.ts`
```typescript
export * from './_schema'
export * from './volkswagen-golf'
// ... all other files
```

### 5. Matching engine

**File:** `src/lib/vehicle/matcher.ts`

```typescript
export interface MatchedIssue extends VehicleIssue {
  specificityScore: number   // higher = more specific match
}

export function matchIssues(
  identity: VehicleIdentity,
  allIssues: VehicleIssue[],
  limit?: number,
): MatchedIssue[]
```

Scoring algorithm (see `docs/knowledge-base.md` for weights):
- Require `make` match as baseline
- Score additional fields: model, generation, yearRange, engineFamily, fuelType, transmission, bodyType
- Sort descending by specificityScore
- Deduplicate by `id`
- Return top `limit` (default: 15)

### 6. Integration into research service

**File:** `src/modules/research/research.service.ts` — **modify existing**

Before calling Claude AI, run the KB matcher:

```typescript
import { normalizeVehicle } from '@/lib/vehicle/normalize'
import { matchIssues }      from '@/lib/vehicle/matcher'
import { issues as allIssues } from '@/data/vehicle-issues'

// In researchVehicle():
const identity     = normalizeVehicle(params)
const kbIssues     = matchIssues(identity, allIssues, 12)
```

Pass `kbIssues` into the Claude prompt so AI skips duplicates.
Merge `kbIssues` into the result alongside AI findings.

### 7. Extended research output

Add to `ResearchOutput`:
```typescript
kbIssues: MatchedIssue[]    // structured KB matches
kbMatchCount: number        // how many KB issues were found
```

## What NOT to change

- `src/modules/scoring/scoring.logic.ts` — do not touch
- `src/app/api/inspection/` route files — do not touch (except analyze-photo if extending)
- Auth routes — do not touch
- Camera hook — do not touch
- Any existing TypeScript types in `src/types/` — extend, don't modify

## Testing approach

1. `normalizeVehicle({ make: 'VW', model: 'Golf 7', year: 2017, fuelType: 'Diesel' })` → assert `generation: 'mk7'`, `make: 'volkswagen'`
2. `matchIssues(identity, allIssues)` with a known VW Golf 2017 diesel → assert timing chain issue appears in top 5
3. Full research call with `make: 'BMW', model: '320d', year: 2015` → assert result has `kbIssues` array, `kbMatchCount > 0`

## File creation order

1. `src/lib/vehicle/types.ts`
2. `data/vehicle-issues/_schema.ts` (same types, re-exported for data layer)
3. `src/lib/vehicle/normalize.ts`
4. `data/vehicle-issues/volkswagen-golf.ts` (first KB data file)
5. `data/vehicle-issues/index.ts`
6. `src/lib/vehicle/matcher.ts`
7. Modify `src/modules/research/research.service.ts`
8. Add remaining KB data files

## Environment requirements

No new environment variables needed. Existing `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` are sufficient.
