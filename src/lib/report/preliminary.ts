import type { InspectionPhase, ChecklistCategory } from '@/types'

export const PRELIMINARY_MIN_PHOTO_COUNT = 5

type PreliminaryVehicleInput = {
  vin?: string | null
  mileage?: number | null
  askingPrice?: number | null
  fuelType?: string | null
  transmission?: string | null
}

export interface PreliminaryMissingDataItem {
  id: 'photos' | 'checklist' | 'vehicle'
  focusPhase: InspectionPhase
  details: string[]
}

export interface PreliminaryMissingDataSummary {
  items: PreliminaryMissingDataItem[]
  firstFocusPhase: InspectionPhase | null
}

const CHECKLIST_CATEGORY_TO_PHASE: Record<ChecklistCategory, InspectionPhase> = {
  PRE_SCREENING: 'PRE_SCREENING',
  EXTERIOR: 'EXTERIOR',
  INTERIOR: 'INTERIOR',
  MECHANICAL: 'MECHANICAL',
  TEST_DRIVE: 'TEST_DRIVE',
  DOCUMENTS: 'VIN_DOCS',
} as const

export function detectPreliminaryMissingData(input: {
  photoCount: number
  checklistIncomplete: boolean
  missingChecklistCategories: ChecklistCategory[]
  vehicle: PreliminaryVehicleInput | null | undefined
  vehicleFieldLabels: Record<'vin' | 'mileage' | 'askingPrice' | 'fuelType' | 'transmission', string>
  checklistCategoryLabels: Partial<Record<ChecklistCategory, string>>
  photoLabel: string
  checklistLabel: string
  vehicleLabel: string
  photoDetailFormatter: (missingCount: number, minimumCount: number) => string
}): PreliminaryMissingDataSummary {
  const items: PreliminaryMissingDataItem[] = []
  const safeVehicle = input.vehicle ?? null

  if (input.photoCount < PRELIMINARY_MIN_PHOTO_COUNT) {
    items.push({
      id: 'photos',
      focusPhase: 'AI_PHOTOS',
      details: [
        input.photoDetailFormatter(PRELIMINARY_MIN_PHOTO_COUNT - input.photoCount, PRELIMINARY_MIN_PHOTO_COUNT),
      ],
    })
  }

  if (input.checklistIncomplete && input.missingChecklistCategories.length > 0) {
    items.push({
      id: 'checklist',
      focusPhase: CHECKLIST_CATEGORY_TO_PHASE[input.missingChecklistCategories[0]],
      details: input.missingChecklistCategories.map((category) =>
        input.checklistCategoryLabels[category] ?? category
      ),
    })
  }

  const missingVehicleFields = (['vin', 'mileage', 'askingPrice', 'fuelType', 'transmission'] as const)
    .filter((field) => {
      const value = safeVehicle?.[field]
      return value === null || value === undefined || value === ''
    })
    .map((field) => input.vehicleFieldLabels[field])

  if (missingVehicleFields.length > 0) {
    items.push({
      id: 'vehicle',
      focusPhase: 'PRE_SCREENING',
      details: missingVehicleFields,
    })
  }

  return {
    items,
    firstFocusPhase: items[0]?.focusPhase ?? null,
  }
}

export function buildInspectionReturnHref(focusPhase?: InspectionPhase | null): string {
  if (!focusPhase) return '/inspection'
  return `/inspection?focus=${encodeURIComponent(focusPhase)}`
}
