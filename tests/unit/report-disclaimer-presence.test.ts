// =============================================================================
// Report disclaimer presence
//
// The report-specific disclaimer (report.disclaimer.full) must appear on
// BOTH the on-screen report page and the generated PDF — a user who only
// ever looks at one of the two must still see it. Source-text checks (rather
// than rendering/parsing a PDF buffer) match this codebase's existing
// approach to static content-wiring checks.
// =============================================================================

import fs from 'fs'
import path from 'path'
import en from '@/i18n/locales/en'
import sr from '@/i18n/locales/sr'

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('report.disclaimer.full wiring', () => {
  it('is defined as a non-empty string in both locales', () => {
    expect(typeof en['report.disclaimer.full']).toBe('string')
    expect((en['report.disclaimer.full'] as string).length).toBeGreaterThan(0)
    expect(typeof sr['report.disclaimer.full']).toBe('string')
    expect((sr['report.disclaimer.full'] as string).length).toBeGreaterThan(0)
  })

  it('is rendered on the on-screen report page', () => {
    const source = read('src/app/report/page.tsx')
    expect(source).toContain("t('report.disclaimer.full')")
  })

  it('is rendered in the generated PDF', () => {
    const source = read('src/lib/report/pdf.ts')
    expect(source).toContain("t('report.disclaimer.full')")
  })
})
