// =============================================================================
// Photo coverage — pure logic tests
//
// Covers the count -> tier mapping (0–2 insufficient / 3–7 partial / 8
// complete) and the valid-photo counting rules: placeholders (no result
// yet), in-flight analysis, failed uploads, unusable images, and photos
// belonging to another vehicle/inspection must never count.
// =============================================================================

import {
  FULL_PHOTO_COUNT,
  MIN_PHOTOS_BEFORE_WARNING,
  getPhotoCoverageTier,
  requiresLowCoverageConfirmation,
  deriveUsability,
  isUsablePhotoResult,
  countValidPhotos,
  type CoveragePhotoLike,
} from '@/lib/inspection/photo-coverage'

describe('photo coverage constants', () => {
  it('expects 8 full photos and warns below 3', () => {
    expect(FULL_PHOTO_COUNT).toBe(8)
    expect(MIN_PHOTOS_BEFORE_WARNING).toBe(3)
  })
})

describe('getPhotoCoverageTier', () => {
  it.each([
    [0, 'INSUFFICIENT'],
    [1, 'INSUFFICIENT'],
    [2, 'INSUFFICIENT'],
    [3, 'PARTIAL'],
    [4, 'PARTIAL'],
    [5, 'PARTIAL'],
    [6, 'PARTIAL'],
    [7, 'PARTIAL'],
    [8, 'COMPLETE'],
    [9, 'COMPLETE'], // defensive: never under-report above the full set
  ] as const)('%i valid photos -> %s', (count, expected) => {
    expect(getPhotoCoverageTier(count)).toBe(expected)
  })
})

describe('requiresLowCoverageConfirmation', () => {
  it.each([0, 1, 2])('is true at %i photos', (count) => {
    expect(requiresLowCoverageConfirmation(count)).toBe(true)
  })
  it.each([3, 7, 8])('is false at %i photos', (count) => {
    expect(requiresLowCoverageConfirmation(count)).toBe(false)
  })
})

describe('deriveUsability', () => {
  it('trusts an explicit isUsable: true from the server', () => {
    expect(deriveUsability({ isUsable: true })).toEqual({ isUsable: true, usabilityReason: 'OK' })
  })

  it('trusts an explicit isUsable: false with its reason', () => {
    expect(deriveUsability({ isUsable: false, usabilityReason: 'UNCERTAIN' }))
      .toEqual({ isUsable: false, usabilityReason: 'UNCERTAIN' })
  })

  it('treats a failureReason as unusable regardless of other fields', () => {
    const result = deriveUsability({ failureReason: 'TIMEOUT', imageQuality: 'good', confidenceScore: 95 })
    expect(result.isUsable).toBe(false)
    expect(result.usabilityReason).toBe('LOW_QUALITY')
  })

  it('classifies an unambiguous "no vehicle" signal as NOT_VEHICLE', () => {
    const result = deriveUsability({ imageQuality: 'unusable', signal: 'No vehicle detected in this image' })
    expect(result).toEqual({ isUsable: false, usabilityReason: 'NOT_VEHICLE' })
  })

  it('does not misclassify a signal that merely mentions the car as NOT_VEHICLE', () => {
    const result = deriveUsability({ imageQuality: 'unusable', signal: 'The car has no visible issues in this frame' })
    expect(result.usabilityReason).toBe('LOW_QUALITY')
  })

  it('treats low confidence as UNCERTAIN', () => {
    expect(deriveUsability({ confidenceScore: 10 })).toEqual({ isUsable: false, usabilityReason: 'UNCERTAIN' })
  })

  it('treats high confidence with no other signal as usable', () => {
    expect(deriveUsability({ confidenceScore: 90 })).toEqual({ isUsable: true, usabilityReason: 'OK' })
  })

  it('isUsablePhotoResult is a thin boolean wrapper over deriveUsability', () => {
    expect(isUsablePhotoResult({ isUsable: true })).toBe(true)
    expect(isUsablePhotoResult({ isUsable: false })).toBe(false)
  })
})

describe('countValidPhotos', () => {
  const VEHICLE = 'vehicle-1'
  const usable: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: false, aiResult: { isUsable: true } }
  const pending: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: true, aiResult: undefined }
  const noResultYet: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: false, aiResult: null }
  const failed: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: false, aiResult: { isUsable: false, failureReason: 'TIMEOUT' } }
  const unusable: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: false, aiResult: { isUsable: false, usabilityReason: 'LOW_QUALITY' } }
  const otherVehicle: CoveragePhotoLike = { vehicleId: 'vehicle-2', isPending: false, aiResult: { isUsable: true } }

  it('returns 0 for an empty list', () => {
    expect(countValidPhotos([], VEHICLE)).toBe(0)
  })

  it('counts only usable, non-pending, correctly-scoped photos', () => {
    expect(countValidPhotos([usable, pending, noResultYet, failed, unusable, otherVehicle], VEHICLE)).toBe(1)
  })

  it('excludes placeholders that have not been analyzed yet', () => {
    expect(countValidPhotos([noResultYet], VEHICLE)).toBe(0)
  })

  it('excludes photos still pending analysis, even with a stale prior result', () => {
    const stalePending: CoveragePhotoLike = { vehicleId: VEHICLE, isPending: true, aiResult: { isUsable: true } }
    expect(countValidPhotos([stalePending], VEHICLE)).toBe(0)
  })

  it('excludes failed uploads', () => {
    expect(countValidPhotos([failed], VEHICLE)).toBe(0)
  })

  it('excludes unusable images', () => {
    expect(countValidPhotos([unusable], VEHICLE)).toBe(0)
  })

  it('excludes a photo belonging to another vehicle/inspection', () => {
    expect(countValidPhotos([otherVehicle], VEHICLE)).toBe(0)
  })

  it('stale client state cannot fake the count by claiming a foreign vehicleId', () => {
    // Even if every other field looks perfectly valid, a mismatched
    // vehicleId is rejected — the scope check is not bypassable by any
    // combination of the other fields.
    const spoofed: CoveragePhotoLike = { vehicleId: 'not-the-current-vehicle', isPending: false, aiResult: { isUsable: true } }
    expect(countValidPhotos([spoofed, spoofed, spoofed], VEHICLE)).toBe(0)
  })

  it('a deleted photo (removed from the array) reduces the count', () => {
    const three = [usable, { ...usable }, { ...usable }]
    expect(countValidPhotos(three, VEHICLE)).toBe(3)
    const afterDelete = three.slice(0, 2)
    expect(countValidPhotos(afterDelete, VEHICLE)).toBe(2)
  })

  it.each([0, 1, 2, 3, 7, 8])('counts exactly %i valid photos out of a mixed set', (n) => {
    const validOnes = Array.from({ length: n }, () => ({ ...usable }))
    const noise = [pending, noResultYet, failed, unusable, otherVehicle]
    expect(countValidPhotos([...validOnes, ...noise], VEHICLE)).toBe(n)
  })

  function failedEntry(): CoveragePhotoLike {
    return { vehicleId: VEHICLE, isPending: false, aiResult: { isUsable: false, failureReason: 'TIMEOUT' } }
  }

  // ── Mixed valid/failed scenarios from the progress-bar correction ─────────
  // The progress bar, tab status, and coverage messaging must all read this
  // exact number — a bar showing "3/8" while 0 are actually valid is exactly
  // the bug this module exists to prevent.
  describe('mixed valid + failed photo scenarios (progress bar must reflect only the valid count)', () => {
    it('0 valid + 3 failed -> coverage is 0/8, not 3/8', () => {
      const photos = [failedEntry(), failedEntry(), failedEntry()]
      const validCount = countValidPhotos(photos, VEHICLE)
      expect(validCount).toBe(0)
      expect(getPhotoCoverageTier(validCount)).toBe('INSUFFICIENT')
      expect(requiresLowCoverageConfirmation(validCount)).toBe(true)
      // The 3 failed attempts remain visible as their own separate count —
      // that's a UI concern (see PhotoGrid's needsRetake), not this module's,
      // but it must never be conflated with validPhotoCount.
      expect(photos).toHaveLength(3)
    })

    it('2 valid + 4 failed -> coverage is 2/8, red tier, confirmation required', () => {
      const photos = [usable, { ...usable }, failedEntry(), failedEntry(), failedEntry(), failedEntry()]
      const validCount = countValidPhotos(photos, VEHICLE)
      expect(validCount).toBe(2)
      expect(getPhotoCoverageTier(validCount)).toBe('INSUFFICIENT')
      expect(requiresLowCoverageConfirmation(validCount)).toBe(true)
    })

    it('3 valid + failed attempts -> coverage is 3/8, partial (non-red) tier, no confirmation required', () => {
      const photos = [usable, { ...usable }, { ...usable }, failedEntry(), failedEntry()]
      const validCount = countValidPhotos(photos, VEHICLE)
      expect(validCount).toBe(3)
      expect(getPhotoCoverageTier(validCount)).toBe('PARTIAL')
      expect(requiresLowCoverageConfirmation(validCount)).toBe(false)
    })

    it('8 valid (plus failed noise) -> full coverage regardless of how many failed attempts exist', () => {
      const eightValid = Array.from({ length: 8 }, () => ({ ...usable }))
      const photos = [...eightValid, failedEntry(), failedEntry()]
      const validCount = countValidPhotos(photos, VEHICLE)
      expect(validCount).toBe(8)
      expect(getPhotoCoverageTier(validCount)).toBe('COMPLETE')
      expect(requiresLowCoverageConfirmation(validCount)).toBe(false)
    })
  })
})
