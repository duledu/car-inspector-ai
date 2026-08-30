// =============================================================================
// Checkbox hit-testing — regression guard
//
// A real-device (Android/TWA) tester found the AI-photo-analysis consent
// checkbox could not be tapped at all: the native <input> relied on
// label[for]-forwarded activation while being pointer-events:none and sized
// to 1x1px — a pattern some Android WebView builds do not reliably deliver.
// Fixed by making the input itself cover the entire clickable row (a real,
// directly-hit-testable target), removing the pointer-events:none.
//
// This is a static source-text check (this repo has no React Testing
// Library anywhere — see report-disclaimer-presence.test.ts for the same
// pattern) rather than a rendered-interaction test.
// =============================================================================

import fs from 'fs'
import path from 'path'

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('AiConsentModal checkbox is a real, fully-tappable hit target', () => {
  const source = read('src/components/inspection/AiConsentModal.tsx')
  // Scope the checks to the <input type="checkbox"> element's own JSX block
  // (from its opening tag to its closing `/>`) — the file legitimately uses
  // pointerEvents: 'none' elsewhere, on a purely decorative background div
  // unrelated to this bug, so a whole-file check would false-positive there.
  const inputBlockMatch = source.match(/<input[\s\S]*?type="checkbox"[\s\S]*?\/>/)
  const inputBlock = inputBlockMatch?.[0] ?? ''

  it('locates the checkbox input block for the remaining checks', () => {
    expect(inputBlock.length).toBeGreaterThan(0)
  })

  it('does not disable pointer-events on the checkbox input', () => {
    // A prior version set pointerEvents: 'none' directly on the <input>,
    // relying entirely on label-forwarded activation to a near-zero-size
    // element — the exact pattern that failed on a real Android device.
    expect(inputBlock).not.toMatch(/pointerEvents:\s*['"]none['"]/)
  })

  it('sizes the input to cover the full row, not a 1x1px dot', () => {
    expect(inputBlock).not.toMatch(/width:\s*1,\s*\n?\s*height:\s*1,/)
    expect(inputBlock).toMatch(/width:\s*['"]100%['"]/)
    expect(inputBlock).toMatch(/height:\s*['"]100%['"]/)
  })

  it('keeps the real native checkbox input (not a fake div-only checkbox)', () => {
    expect(source).toContain('type="checkbox"')
    expect(source).toContain('checked={checked}')
    expect(source).toContain('onChange={e => setChecked(e.target.checked)}')
  })

  it('keeps Continue disabled until checked, and enabled once checked (no consent weakening)', () => {
    expect(source).toContain('disabled={!checked}')
  })

  it('initial checked state is false, never pre-checked', () => {
    expect(source).toContain('useState(false)')
  })
})

describe('ConsentCheckboxRow (legal Terms/Privacy/Risk-Ack checkboxes) does not share the same bug', () => {
  const source = read('src/components/legal/ConsentCheckboxRow.tsx')
  const inputBlockMatch = source.match(/<input[\s\S]*?type="checkbox"[\s\S]*?\/>/)
  const inputBlock = inputBlockMatch?.[0] ?? ''

  it('locates the checkbox input block for the remaining checks', () => {
    expect(inputBlock.length).toBeGreaterThan(0)
  })

  it('does not disable pointer-events on its checkbox input either', () => {
    expect(inputBlock).not.toMatch(/pointerEvents:\s*['"]none['"]/)
  })

  it('gives the input a real, non-zero hit area', () => {
    expect(inputBlock).not.toMatch(/width:\s*1,\s*\n?\s*height:\s*1,/)
  })
})
