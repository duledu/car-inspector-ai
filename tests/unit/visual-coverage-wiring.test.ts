// =============================================================================
// Visual coverage (report-semantics scoring bug fix) — content wiring
//
// Static source-text checks (matching this repo's established pattern, see
// photo-coverage-wiring.test.ts) confirming the visualCoverage signal that
// stops "0 photos" from ever reading as a passing visual assessment is
// actually threaded through the scoring engine, the on-screen report, and
// the PDF — not just present in one surface while the other still shows
// the old, contradictory "Strong Buy" / numeric score copy.
// =============================================================================

import fs from 'fs'
import path from 'path'
import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

const NEW_KEYS = [
  'report.decision.headline.limitedAssessment',
  'report.decision.body.limitedAssessmentNoPhotos',
  'report.decision.body.limitedAssessmentFewPhotos',
  'report.visualNotAssessed',
] as const

describe('visual coverage i18n keys', () => {
  it.each(NEW_KEYS)('%s is a non-empty string in en and sr', (key) => {
    expect(typeof en[key]).toBe('string')
    expect((en[key] as string).length).toBeGreaterThan(0)
    expect(typeof sr[key]).toBe('string')
    expect((sr[key] as string).length).toBeGreaterThan(0)
  })

  it('the no-photos limited-assessment body never claims the vehicle was cleared or safe', () => {
    const body = en['report.decision.body.limitedAssessmentNoPhotos']
    expect(body).toMatch(/not been assessed|not performed/i)
    expect(body).not.toMatch(/strong buy|safe to proceed|no significant issues|passes the major checks/i)
  })
})

describe('visual coverage wiring — scoring engine', () => {
  const source = read('src/modules/scoring/scoring.logic.ts')

  it('derives an explicit visualCoverage tier rather than only a raw score', () => {
    expect(source).toContain('getVisualCoverage')
    expect(source).toContain("'NOT_ASSESSED'")
    expect(source).toContain("'LIMITED'")
    expect(source).toContain("'PARTIAL'")
    expect(source).toContain("'FULL'")
  })

  it('caps the verdict when visual coverage is missing or limited, and never silently averages in an unassessed dimension', () => {
    expect(source).toContain('enforceVisualCoverageCap')
    expect(source).toContain('computeWeightedBuyScore')
    expect(source).toContain("visualCoverage !== 'NOT_ASSESSED'")
  })

  it('the zero-photo branch no longer returns the old hardcoded passing-looking score', () => {
    // The bug real testers hit: a bare positive number (68) with no
    // assessment behind it, dragged into a "Strong Buy" verdict.
    expect(source).not.toMatch(/score:\s*68\b/)
  })
})

describe('visual coverage wiring — on-screen report', () => {
  const source = read('src/app/report/page.tsx')

  it('DimBar can render a "not assessed" state instead of a numeric score bar', () => {
    expect(source).toContain('notAssessed')
    expect(source).toContain('notAssessedLabel')
  })

  it('the AI dimension bar is driven by the authoritative visualCoverage signal, not a locally re-derived photo count', () => {
    expect(source).toContain("signals?.visualCoverage === 'NOT_ASSESSED'")
  })

  it('the decision block receives visualCoverage so it can override verdict-only copy', () => {
    expect(source).toContain('visualCoverage={riskScore.dimensions.ai.signals?.visualCoverage}')
  })
})

describe('visual coverage wiring — decision copy', () => {
  const source = read('src/app/report/ReportSections.tsx')

  it('overrides the verdict-keyed headline/body when visual coverage is NOT_ASSESSED or LIMITED', () => {
    expect(source).toContain("visualCoverage === 'NOT_ASSESSED'")
    expect(source).toContain("visualCoverage === 'LIMITED'")
    expect(source).toContain('report.decision.headline.limitedAssessment')
  })

  it('never applies the override to HIGH_RISK/WALK_AWAY verdicts (a genuinely bad result must not be softened into "limited")', () => {
    expect(source).toContain("verdict !== 'HIGH_RISK' && verdict !== 'WALK_AWAY'")
  })
})

describe('visual coverage wiring — PDF', () => {
  const source = read('src/lib/report/pdf.ts')

  it('reads visualCoverage from the server-authoritative score object, not a client-sent photo count', () => {
    expect(source).toContain('score.dimensions.ai.signals?.visualCoverage')
  })

  it('renders the AI dimension bar as not-assessed and reuses the same limited-assessment copy keys as the web report', () => {
    expect(source).toContain('report.visualNotAssessed')
    expect(source).toContain('report.decision.headline.limitedAssessment')
    expect(source).toContain('report.decision.body.limitedAssessmentNoPhotos')
    expect(source).toContain('report.decision.body.limitedAssessmentFewPhotos')
  })
})
