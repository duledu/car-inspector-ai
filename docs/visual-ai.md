# Visual AI — Photo Analysis

## Purpose

Detect visible defects, damage, and anomalies in vehicle photos using GPT-4o vision. Photo analysis is AI-first — there is no structured alternative for image content. However, findings are structured (not free text) so they integrate cleanly with the scoring engine.

## Location

`src/app/api/inspection/analyze-photo/route.ts`

## Flow

```
Photo upload → base64 encode → POST /api/inspection/analyze-photo
  → GPT-4o vision + angle-specific prompt
  → Structured PhotoFinding[]
  → Stored in inspection state
  → Feeds AIFinding[] in scoring input
```

## Supported Angles

| Angle key | What it covers |
|-----------|---------------|
| `exterior_front` | Front damage, headlights, hood gaps, bumper |
| `exterior_rear` | Rear damage, taillights, trunk panel fit |
| `exterior_side_left` | Door panel condition, sill rust, window seals |
| `exterior_side_right` | Mirror to mirror, door gaps |
| `exterior_roof` | Hail damage, sunroof condition, panorama cracks |
| `engine_bay` | Oil leaks, corrosion, wiring, modifications |
| `interior_front` | Dashboard cracks, steering wheel wear, airbag light |
| `interior_rear` | Seat wear, upholstery condition |
| `tyres_front` | Tread depth, uneven wear (alignment indicator) |
| `tyres_rear` | Wear pattern, sidewall condition |
| `underbody` | Rust, structural damage, accident repair |

## PhotoFinding Schema

```typescript
export interface PhotoFinding {
  angle:      string           // angle key from above
  signal:     string           // snake_case defect label: 'rust', 'dent', 'oil_leak', etc.
  severity:   PhotoSeverity    // 'none' | 'minor' | 'moderate' | 'severe'
  detail:     string           // 1–2 sentence human-readable description
  confidence: number           // 0.0–1.0
  bbox?:      BoundingBox      // future: localise defect on image
}

export type PhotoSeverity = 'none' | 'minor' | 'moderate' | 'severe'
```

## Signal Taxonomy

| Signal | Category | Example severity |
|--------|----------|-----------------|
| `rust_surface` | body | minor–moderate |
| `rust_structural` | body | severe |
| `dent_minor` | body | minor |
| `dent_major` | body | moderate–severe |
| `paint_respray` | body | moderate (hidden repair) |
| `panel_misalignment` | body | moderate (accident indicator) |
| `oil_leak` | mechanical | moderate–severe |
| `coolant_leak` | mechanical | severe |
| `battery_corrosion` | electrical | minor–moderate |
| `wiring_modification` | electrical | moderate |
| `airbag_warning_light` | safety | severe |
| `crack_windshield` | safety | minor–severe |
| `tyre_worn` | wear | minor–severe |
| `tyre_uneven_wear` | wear | moderate (alignment issue) |
| `interior_tear` | cosmetic | minor |
| `dashboard_crack` | cosmetic | minor |
| `analysis_failed` | system | none |

## Prompt Architecture

Each angle uses a specialized prompt section:

```
System: You are an expert used-car inspection assistant. Analyze the photo and return a JSON array of defects found.
User: [angle-specific instructions + JSON schema]
```

Engine bay prompt specifically instructs:
- Look for oil stains on engine, hoses, gaskets
- Check for corrosion on battery terminals
- Note any non-OEM wiring or modifications
- Check coolant reservoir level and color

Exterior prompts specifically instruct:
- Check panel gaps for uniformity (misalignment = accident)
- Look for paint texture differences (respray detection)
- Check for rust at panel edges, sills, wheel arches

## Scoring Integration

`PhotoFinding[]` → mapped to `AIFinding[]` for `scoring.logic.ts`:

```typescript
function photoFindingToAIFinding(f: PhotoFinding): AIFinding {
  return {
    type:       f.signal,
    severity:   mapSeverity(f.severity),   // 'critical'|'major'|'minor'|'info'
    confidence: f.confidence,
    description: f.detail,
  }
}
```

The `ai_assessment` scoring dimension (weight: 25) consumes these findings.

## Privacy Note

Photos are base64-encoded and sent directly to OpenAI's API. They are NOT stored server-side after analysis. The base64 string is not persisted to the database — only the structured `PhotoFinding` result is stored.

Inform users of this in the Privacy Policy (already done in `/legal/privacy`).
