# Vehicle Normalization

## Purpose

Transform raw, user-supplied vehicle data into a canonical `VehicleIdentity` object used by the matching engine and all downstream layers. Without normalization, "Golf" ≠ "GOLF" ≠ "VW Golf" and matching breaks.

## Location

`src/lib/vehicle/normalize.ts`

## VehicleIdentity Schema

```typescript
export interface VehicleIdentity {
  make:         string          // "volkswagen" (lowercase, trimmed)
  model:        string          // "golf" (lowercase, trimmed)
  generation:   string | null   // "mk7", "b8", "w204" etc.
  yearFrom:     number          // exact year or range start
  yearTo:       number          // exact year or range end (same as yearFrom if exact)
  bodyType:     BodyType | null // 'sedan' | 'hatchback' | 'suv' | 'estate' | 'coupe' | 'van' | 'pickup' | 'convertible' | 'minivan'
  fuelType:     FuelType | null // 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'cng'
  transmission: Transmission | null // 'manual' | 'automatic' | 'dct' | 'cvt'
  drivetrain:   Drivetrain | null   // 'fwd' | 'rwd' | 'awd' | '4wd'
  engineFamily: string | null   // "ea288", "n47", "m57", "om642" — engine code family
  engineCc:     number | null   // displacement in cc
  powerKw:      number | null
  mileage:      number | null   // in km
  locale:       string          // "en" | "sr" | "de" | "mk" | "sq"
}
```

## Normalization Rules

### Make normalization
```
"VW" → "volkswagen"
"Merc" | "Mercedes" | "MB" → "mercedes-benz"
"BMW" → "bmw"
"Audi" → "audi"
```
Trim whitespace, lowercase. Unknown makes pass through lowercased.

### Model normalization
```
"Golf 7" | "Golf VII" | "Golf Mk7" → "golf" (generation extracted separately)
"3 Series" | "3er" → "3-series"
"C-Class" | "C Class" → "c-class"
```

### Generation detection
Generation is extracted from model name or year range:
```
Golf 2013–2020 → generation: "mk7"
Golf 2020+     → generation: "mk8"
A4 B8 (2008–2015) → generation: "b8"
```
Known generation maps are in `src/lib/vehicle/generations.ts`.

### Engine family extraction
From `engine` free-text field:
```
"2.0 TDI" on VW/Audi 2009+ → engineFamily: "ea288" (post-2015) or "ea189" (pre-2016)
"3.0d" on BMW E90/F30 → engineFamily: "n57" or "m57"
```
Engine family maps are in `src/lib/vehicle/engine-families.ts`.

## API

```typescript
import { normalizeVehicle } from '@/lib/vehicle/normalize'

const identity = normalizeVehicle({
  make: 'VW',
  model: 'Golf 7',
  year: 2017,
  fuelType: 'Diesel',
  transmission: 'Automatic',
  engineCc: 1968,
  mileage: 120000,
  locale: 'sr',
})
// → { make: 'volkswagen', model: 'golf', generation: 'mk7', yearFrom: 2017, yearTo: 2017, fuelType: 'diesel', transmission: 'automatic', engineFamily: 'ea288', ... }
```

## Confidence

Normalization does not fail — it returns what it can and sets `null` for unknown fields. The matcher uses specificity scoring to handle partial identity.
