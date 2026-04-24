import { buildInspectionReturnHref, detectPreliminaryMissingData, PRELIMINARY_MIN_PHOTO_COUNT } from '../../src/lib/report/preliminary'

describe('detectPreliminaryMissingData', () => {
  const baseLabels = {
    vehicleFieldLabels: {
      vin: 'VIN broj',
      mileage: 'Kilometraza',
      askingPrice: 'Cena vozila',
      fuelType: 'Gorivo',
      transmission: 'Menjac',
    },
    checklistCategoryLabels: {
      EXTERIOR: 'Spoljasnjost',
      INTERIOR: 'Unutrasnjost',
      MECHANICAL: 'Mehanika',
      TEST_DRIVE: 'Test voznja',
      DOCUMENTS: 'Dokumentacija',
      PRE_SCREENING: 'Pre-screening',
    },
    photoLabel: 'Slike',
    checklistLabel: 'Checklist',
    vehicleLabel: 'Podaci o vozilu',
    photoDetailFormatter: (missingCount: number, minimumCount: number) =>
      `Jos ${missingCount} fotografija (minimum ${minimumCount}).`,
  } as const

  test('detects missing photos, checklist categories, and key vehicle fields', () => {
    const result = detectPreliminaryMissingData({
      photoCount: 2,
      checklistIncomplete: true,
      missingChecklistCategories: ['EXTERIOR', 'DOCUMENTS'],
      vehicle: {
        vin: null,
        mileage: null,
        askingPrice: 12_500,
        fuelType: '',
        transmission: null,
      },
      ...baseLabels,
    })

    expect(result.firstFocusPhase).toBe('AI_PHOTOS')
    expect(result.items).toEqual([
      {
        id: 'photos',
        focusPhase: 'AI_PHOTOS',
        details: [`Jos ${PRELIMINARY_MIN_PHOTO_COUNT - 2} fotografija (minimum ${PRELIMINARY_MIN_PHOTO_COUNT}).`],
      },
      {
        id: 'checklist',
        focusPhase: 'EXTERIOR',
        details: ['Spoljasnjost', 'Dokumentacija'],
      },
      {
        id: 'vehicle',
        focusPhase: 'PRE_SCREENING',
        details: ['VIN broj', 'Kilometraza', 'Gorivo', 'Menjac'],
      },
    ])
  })

  test('returns no missing items when the preliminary inputs are sufficiently complete', () => {
    const result = detectPreliminaryMissingData({
      photoCount: PRELIMINARY_MIN_PHOTO_COUNT,
      checklistIncomplete: false,
      missingChecklistCategories: [],
      vehicle: {
        vin: 'WVWZZZ1JZXW000001',
        mileage: 150_000,
        askingPrice: 8_900,
        fuelType: 'diesel',
        transmission: 'manual',
      },
      ...baseLabels,
    })

    expect(result.items).toEqual([])
    expect(result.firstFocusPhase).toBeNull()
  })
})

describe('buildInspectionReturnHref', () => {
  test('returns the base inspection route when there is no focus phase', () => {
    expect(buildInspectionReturnHref()).toBe('/inspection')
    expect(buildInspectionReturnHref(null)).toBe('/inspection')
  })

  test('encodes the focus phase in the inspection return route', () => {
    expect(buildInspectionReturnHref('VIN_DOCS')).toBe('/inspection?focus=VIN_DOCS')
  })
})
