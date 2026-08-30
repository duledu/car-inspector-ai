// =============================================================================
// Photo coverage — content wiring
//
// Static source-text checks (matching this repo's established pattern, see
// report-disclaimer-presence.test.ts) confirming the new coverage-tier
// copy exists in both locales and is actually referenced by the three
// surfaces that must show it: the live inspection page, the on-screen
// report, and the PDF.
// =============================================================================

import fs from 'fs'
import path from 'path'
import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

const NEW_KEYS = [
  'inspection.lowCoverageWarning.title',
  'inspection.lowCoverageWarning.body',
  'inspection.lowCoverageWarning.addMore',
  'inspection.lowCoverageWarning.continueAnyway',
  'inspection.insufficientCoverageNotice',
  'inspection.partialCoverageNotice',
  'report.photoCoverage.notPerformed.title',
  'report.photoCoverage.notPerformed.body',
  'report.photoCoverage.limited.title',
  'report.photoCoverage.limited.body',
  'report.photoCoverage.partial.title',
  'report.photoCoverage.partial.body',
  'report.photoCoverage.full.title',
] as const

describe('photo coverage i18n keys', () => {
  it.each(NEW_KEYS)('%s is a non-empty string in en and sr', (key) => {
    expect(typeof en[key]).toBe('string')
    expect((en[key] as string).length).toBeGreaterThan(0)
    expect(typeof sr[key]).toBe('string')
    expect((sr[key] as string).length).toBeGreaterThan(0)
  })

  it('the low-coverage warning body matches the required English concept (title, no-photos framing, explicit question)', () => {
    const body = en['inspection.lowCoverageWarning.body']
    expect(body).toMatch(/fewer than 3/i)
    expect(body).toMatch(/less accurate|miss visible damage/i)
    expect(body).toMatch(/continue/i)
    expect(body.trim().endsWith('?')).toBe(true)
  })

  it('report.noPhotosAnalysis no longer says "No photos added" (must not read as neutral/positive)', () => {
    expect(en['report.noPhotosAnalysis.title']).not.toMatch(/no photos added/i)
    expect(en['report.noPhotosAnalysis.title']).toMatch(/not performed/i)
  })
})

describe('photo coverage wiring — live inspection page', () => {
  const source = read('src/app/inspection/page.tsx')

  it('imports the shared photo-coverage module rather than re-deriving tiers/usability locally', () => {
    expect(source).toContain("from '@/lib/inspection/photo-coverage'")
    expect(source).toContain('getPhotoCoverageTier')
    expect(source).toContain('requiresLowCoverageConfirmation')
    expect(source).toContain('countValidPhotos')
  })

  it('the Photos progress bar and RiskAnalysisPhase summary both read the same validPhotoCount prop, never a separately re-derived value', () => {
    expect(source).toContain('<PhotoGrid photos={photos} validPhotoCount={validPhotoCount}')
    expect(source).toContain('<RiskAnalysisPhase')
    expect(source).toContain('validPhotoCount={validPhotoCount}')
    // The old re-derivation this replaced must be gone, not left dangling
    // alongside the prop (which would let the two silently disagree again).
    expect(source).not.toContain('const successCount = analyzed.length - failed.length - unusable.length')
  })

  it('renders the low-coverage warning modal', () => {
    expect(source).toContain('PhotoCoverageWarningModal')
  })

  it('renders the partial and insufficient coverage notices', () => {
    expect(source).toContain("t('inspection.partialCoverageNotice'")
    expect(source).toContain("t('inspection.insufficientCoverageNotice'")
  })
})

describe('photo coverage wiring — on-screen report', () => {
  const source = read('src/app/report/page.tsx')

  it('computes a valid (usability-filtered) photo count, not just a raw capture count', () => {
    expect(source).toContain('countValidReportPhotos')
    expect(source).toContain('reportValidPhotoCount')
  })

  it('renders the limited/partial coverage banner keys', () => {
    expect(source).toContain('report.photoCoverage.limited.title')
    expect(source).toContain('report.photoCoverage.partial.title')
  })

  it('sends the valid photo count to the PDF endpoint', () => {
    expect(source).toContain('reportValidPhotoCount)')
  })
})

describe('photo coverage wiring — PDF', () => {
  const source = read('src/lib/report/pdf.ts')

  it('accepts a validPhotoCount and derives a coverage tier from it', () => {
    expect(source).toContain('validPhotoCount')
    expect(source).toContain('getPhotoCoverageTier')
  })

  it('renders all four report-status headline keys', () => {
    expect(source).toContain('report.photoCoverage.notPerformed.title')
    expect(source).toContain('report.photoCoverage.limited.title')
    expect(source).toContain('report.photoCoverage.partial.title')
    expect(source).toContain('report.photoCoverage.full.title')
  })
})
