# Knowledge Base — Vehicle Issues

## Purpose

A deterministic, curated dataset of known vehicle issues, weak points, and inspection guidance. This is the structured backbone of the hybrid system — not AI-generated, not crowd-sourced from runtime, but pre-authored and version-controlled.

## Location

`/data/vehicle-issues/` — one file per make or make+model group.

```
/data/vehicle-issues/
  index.ts              ← re-exports all issue arrays
  volkswagen-golf.ts
  volkswagen-passat.ts
  bmw-3series.ts
  bmw-5series.ts
  mercedes-c-class.ts
  mercedes-e-class.ts
  audi-a4.ts
  audi-a6.ts
  ford-focus.ts
  opel-astra.ts
  toyota-corolla.ts
  renault-megane.ts
  _schema.ts            ← TypeScript types (source of truth)
```

## VehicleIssue Schema

```typescript
export interface VehicleIssue {
  // ── Identity ────────────────────────────────────────────────────────────────
  id:           string          // stable unique ID, e.g. "vw-golf-mk7-ea288-timing"
  make:         string          // "volkswagen"
  model:        string | null   // "golf" | null (null = applies to all models of make)
  generation:   string | null   // "mk7" | null
  yearRange:    [number, number] | null  // [2013, 2020] | null
  bodyType:     BodyType[] | null        // ['hatchback','estate'] | null = all
  fuelType:     FuelType[] | null        // ['diesel'] | null = all
  engineFamily: string[] | null          // ['ea288'] | null = all
  transmission: Transmission[] | null    // ['automatic','dct'] | null = all
  drivetrain:   Drivetrain[] | null

  // ── Issue ───────────────────────────────────────────────────────────────────
  title:          string   // "Timing chain stretch (EA288 2.0 TDI)"
  category:       IssueCategory  // 'mechanical' | 'electrical' | 'body' | 'interior' | 'safety' | 'wear' | 'rust'
  severity:       'critical' | 'major' | 'minor' | 'cosmetic'
  frequency:      'widespread' | 'common' | 'occasional' | 'rare'

  // ── Detail ──────────────────────────────────────────────────────────────────
  explanation:       string   // What fails, why, symptoms
  inspectionAdvice:  string   // What to physically check during inspection
  estimatedRepairCost?: { min: number; max: number; currency: 'EUR' }
  mileageWindow?:    [number, number]  // km range where issue typically manifests

  // ── Meta ────────────────────────────────────────────────────────────────────
  confidence:        'high' | 'medium' | 'low'
  // high   = documented TSB, official recall, or widely published engineering defect
  // medium = community consensus across multiple reliable sources
  // low    = anecdotal, low sample size
  source?:           string  // "VW TSB 2033857/5", "NHTSA #12345", "community"
  applicabilityNotes?: string  // "Only applies to pre-facelift (pre-2016) units"
}
```

## Matching Specificity

Issues are scored by how many identity fields match. More specific = higher priority:

```
engineFamily match  → +50
generation match    → +30
yearRange match     → +20
fuelType match      → +15
transmission match  → +10
bodyType match      → +5
model match         → +25
make match (req.)   → base
```

Issues with higher specificity score appear first in the report.

## Writing Issues

Guidelines for authoring entries:

1. **Be specific** — "2.0 TDI EA288 timing chain" beats "diesel engine problems"
2. **Actionable advice** — inspection advice must describe a physical action: "Listen for rattling on cold start", "Check oil level before inspection", "Request DSG service records (interval: 60,000 km)"
3. **Repair cost** — EUR ranges for the Balkan/CE market, not UK/US prices
4. **Confidence** — only mark `high` if there is a TSB, recall, or manufacturer acknowledgement

## Example Entry

```typescript
{
  id:           'vw-golf-mk7-ea288-timing-chain',
  make:         'volkswagen',
  model:        'golf',
  generation:   'mk7',
  yearRange:    [2013, 2019],
  fuelType:     ['diesel'],
  engineFamily: ['ea288'],
  transmission: null,
  bodyType:     null,
  drivetrain:   null,

  title:         'Timing chain stretch (EA288 2.0 TDI)',
  category:      'mechanical',
  severity:      'critical',
  frequency:     'common',

  explanation:   'The EA288 diesel engine uses a timing chain instead of a belt. Under normal conditions the chain should last the life of the engine, but inadequate oil changes or extended service intervals cause the chain tensioner to fail. A stretched chain can jump timing, causing catastrophic engine damage.',
  inspectionAdvice: 'On cold start, listen for a rattling noise from the front of the engine lasting 2–5 seconds. Request full service history — oil changes must be at or before 15,000 km intervals. Check for oil sludge on the oil cap.',
  estimatedRepairCost: { min: 800, max: 1800, currency: 'EUR' },
  mileageWindow: [80000, 180000],

  confidence:    'high',
  source:        'VW TSB 2033857/5, multiple confirmed NHTSA complaints',
  applicabilityNotes: 'Pre-2020 production. 2020+ units use revised tensioner.',
}
```

## Adding New Makes/Models

1. Create `/data/vehicle-issues/make-model.ts`
2. Export a `const issues: VehicleIssue[]` array
3. Add `export * from './make-model'` to `index.ts`
4. The matcher picks it up automatically — no registration required
