# Pricing Engine

## Purpose

Provide region-aware market price estimates and value assessments for used vehicles. The pricing engine is locale-driven — the same car has different market values in Serbia vs. Germany vs. North Macedonia.

## Location

`src/modules/pricing/` — existing module, extended for regional awareness.

## Architecture

```
Locale → Market Region → Price Lookup → Price Context
```

### Locale → Market Region mapping

| Locale | Market Region | Currency | Market Notes |
|--------|--------------|----------|--------------|
| `sr` | Serbia | EUR (shadow), RSD official | Import-heavy, EU vehicles common |
| `mk` | North Macedonia | EUR (de facto) | Small market, import from DE/AT |
| `sq` | Albania/Kosovo | EUR | Very import-dependent |
| `de` | Germany/Austria | EUR | Reference market, deep liquidity |
| `en` | International/EU | EUR | Default |

### Price sources (priority order)

1. **Structured price tables** — pre-researched price bands per make/model/year/km band in `src/modules/pricing/price-tables.ts`
2. **External API** — carVertical, autoDNA, or similar (integration in `src/modules/integrations/`)
3. **AI estimate** — Claude asked for market context prose only, not a number
4. **Fallback** — no price shown, `confidence: 'none'`

## PriceContext Schema

```typescript
export interface PriceContext {
  estimatedMin:   number | null   // EUR
  estimatedMax:   number | null   // EUR
  askingPrice:    number | null   // user-entered
  currency:       string          // display currency
  verdict:        PriceVerdict    // 'fair' | 'high' | 'low' | 'unknown'
  confidence:     'high' | 'medium' | 'low' | 'none'
  marketRegion:   string          // 'serbia' | 'macedonia' | 'germany' | etc.
  notes:          string          // prose context from AI or structured source
}

export type PriceVerdict = 'fair' | 'high' | 'low' | 'unknown'
```

## Price Verdict Logic

```
if askingPrice < estimatedMin * 0.85 → 'low'  (potential issue or great deal)
if askingPrice > estimatedMax * 1.15 → 'high' (overpriced for market)
else                                 → 'fair'
if no estimate                       → 'unknown'
```

## Scoring Integration

`PriceVerdict` feeds into the `PRICE` scoring dimension (not yet a separate dimension — currently embedded in the `ai_assessment` dimension). Future: add dedicated pricing dimension to `scoring.logic.ts`.

## Regional Price Adjustments

Balkan markets typically price 15–25% below Western European reference:

```typescript
const REGIONAL_DISCOUNT: Record<string, number> = {
  'germany':    1.00,   // reference
  'austria':    1.00,
  'serbia':     0.82,
  'macedonia':  0.78,
  'albania':    0.75,
  'kosovo':     0.76,
}
```

A VW Golf Mk7 2017 2.0 TDI at €12,000 in Germany → expect €9,840 in Serbia.

## Mileage Band Adjustment

```
< 50,000 km  → +15% premium
50–100k km   → baseline
100–150k km  → -10%
150–200k km  → -20%
> 200k km    → -35%
```

## Important Notes

- Always show price as **range**, not a single number. Point estimates create false precision.
- Never guarantee price accuracy. Display with appropriate disclaimer.
- If `confidence: 'none'`, show "Market data unavailable" rather than hiding the section entirely.
