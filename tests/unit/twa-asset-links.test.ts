// =============================================================================
// TWA Digital Asset Links — Regression Guard
//
// A missing signing certificate or a middleware-gated `.well-known` route
// silently degrades the TWA to a Custom Tab (persistent browser URL bar) —
// see commit 0ad5852. These are static checks against the source files, not
// live network calls, so they catch a regression before deploy.
// =============================================================================
import fs from 'fs'
import path from 'path'

const assetLinksPath = path.join(process.cwd(), 'public/.well-known/assetlinks.json')
const middlewarePath = path.join(process.cwd(), 'middleware.ts')
const nextConfigPath = path.join(process.cwd(), 'next.config.js')

const PACKAGE_NAME = 'com.usedcarsdoctor.app'
const RELATION = 'delegate_permission/common.handle_all_urls'
const PLAY_INSTALLED_CERT = 'ED:F1:2C:97:41:07:2F:FF:78:12:8F:6B:01:2F:0E:45:1A:A7:54:D8:73:FD:D7:56:A2:2C:B8:77:A8:AA:8D:89'
const PLAY_SIGNING_CERT = '32:1A:90:F3:0B:E3:29:06:B8:30:95:26:BA:1B:3D:A2:5F:E5:AF:D4:70:6F:02:36:7A:BE:16:84:47:BE:2F:4F'

describe('assetlinks.json', () => {
  const statements = JSON.parse(fs.readFileSync(assetLinksPath, 'utf8'))

  test('targets the correct package, relation, and namespace', () => {
    expect(statements[0].relation).toEqual([RELATION])
    expect(statements[0].target.namespace).toBe('android_app')
    expect(statements[0].target.package_name).toBe(PACKAGE_NAME)
  })

  test('includes the certificates actually used to sign distributed builds', () => {
    const fingerprints = statements[0].target.sha256_cert_fingerprints
    expect(fingerprints).toContain(PLAY_INSTALLED_CERT)
    expect(fingerprints).toContain(PLAY_SIGNING_CERT)
  })

  test('has no duplicate or malformed fingerprints', () => {
    const fingerprints: string[] = statements[0].target.sha256_cert_fingerprints
    expect(new Set(fingerprints).size).toBe(fingerprints.length)
    for (const fp of fingerprints) {
      expect(fp).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
    }
  })
})

describe('middleware', () => {
  test('excludes /.well-known from auth/redirect matching', () => {
    const source = fs.readFileSync(middlewarePath, 'utf8')
    const matcherLine = source.match(/matcher:\s*\[([^\]]*)\]/)?.[1] ?? ''
    expect(matcherLine).toMatch(/\\\.well-known/)
  })
})

describe('www redirect', () => {
  test('next.config.js redirects www to the apex host', () => {
    const source = fs.readFileSync(nextConfigPath, 'utf8')
    expect(source).toMatch(/www\.usedcarsdoctor\.com/)
    expect(source).toMatch(/destination:\s*['"]https:\/\/usedcarsdoctor\.com/)
  })
})
