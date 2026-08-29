import { computeLegalContentHash } from '@/lib/legal/legal-content-hash'
import { LEGAL_CONTENT_MANIFESTS } from '@/lib/legal/legal-content-manifest'
import en from '@/i18n/locales/en'

// Pins the sha256 of each legal document's canonical (English) text as it
// stood when CURRENT_TERMS_VERSION / CURRENT_PRIVACY_VERSION /
// CURRENT_RISK_ACK_VERSION were last set (see legal-config.ts). If this test
// fails, the section text changed without a matching version bump — either
// bump the version (which requires every user to re-consent) or revert the
// wording change.
const PINNED_HASHES = {
  TERMS: '721ee34568db784a681bbcf9e161b9e4a517f3b2e35e76ada7ffdcaefde3f2cf',
  PRIVACY: '5fcb798651c7b3ebfe03116cafdfeef2b970e1fc5f2abeb659c974e5e7c2969f',
  RISK_ACKNOWLEDGEMENT: 'acf160885226397abd86ca55f6edb13e9e2f50fd7b04681babb56cc2da7f2431',
} as const

describe('legal content hash', () => {
  it.each(Object.entries(PINNED_HASHES))('%s content hash matches the pinned value', (documentType, expected) => {
    expect(computeLegalContentHash(documentType as keyof typeof PINNED_HASHES)).toBe(expected)
  })

  it('is deterministic for the same content', () => {
    expect(computeLegalContentHash('TERMS')).toBe(computeLegalContentHash('TERMS'))
  })

  it('throws if a manifest key is missing from en.ts', () => {
    const original = (en as Record<string, string>)['legal.terms.s1.title']
    delete (en as Record<string, string>)['legal.terms.s1.title']
    try {
      expect(() => computeLegalContentHash('TERMS')).toThrow(/missing en\.ts key/)
    } finally {
      ;(en as Record<string, string>)['legal.terms.s1.title'] = original
    }
  })

  it('every manifest key resolves to a non-empty string in en.ts', () => {
    for (const [documentType, keys] of Object.entries(LEGAL_CONTENT_MANIFESTS)) {
      for (const key of keys) {
        const value = (en as Record<string, string>)[key]
        expect(typeof value).toBe('string')
        expect((value as string).length).toBeGreaterThan(0)
      }
      expect(keys.length).toBeGreaterThan(0)
      void documentType
    }
  })
})
