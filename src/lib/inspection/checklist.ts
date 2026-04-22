import type { ChecklistCategory, ChecklistItem, ItemStatus } from '@/types'

export type ChecklistSeedItem = {
  category: Exclude<ChecklistCategory, 'PRE_SCREENING'>
  itemKey: string
  itemLabel: string
}

export type NormalizableChecklistItem = {
  id: string
  sessionId?: string
  category: ChecklistCategory | string
  itemKey: string
  itemLabel: string
  status: ItemStatus | string
  notes?: string | null
  photoUrl?: string | null
  updatedAt?: Date | string | null
}

export type InspectionCompletionCategory = Exclude<ChecklistCategory, 'PRE_SCREENING'>

export type InspectionCompletionSummary = {
  isComplete: boolean
  answeredCount: number
  totalCount: number
  missingCategories: InspectionCompletionCategory[]
  categoryProgress: Record<InspectionCompletionCategory, { answered: number; total: number; complete: boolean }>
}

export const COMPACT_INSPECTION_CHECKLIST: ChecklistSeedItem[] = [
  { category: 'EXTERIOR', itemKey: 'ext_paint', itemLabel: 'Paint, body panels and repair signs' },
  { category: 'EXTERIOR', itemKey: 'ext_rust', itemLabel: 'Rust on body, sills and underbody' },
  { category: 'EXTERIOR', itemKey: 'ext_tires', itemLabel: 'Tires and wheels' },
  { category: 'EXTERIOR', itemKey: 'ext_lights', itemLabel: 'Lights, glass and exterior safety' },
  { category: 'INTERIOR', itemKey: 'int_seats', itemLabel: 'Seats, wear and interior trim' },
  { category: 'INTERIOR', itemKey: 'int_dash', itemLabel: 'Dashboard warnings, controls and electronics' },
  { category: 'INTERIOR', itemKey: 'int_ac', itemLabel: 'Air conditioning & heating system' },
  { category: 'INTERIOR', itemKey: 'int_odometer', itemLabel: 'Mileage consistency and cabin condition' },
  { category: 'MECHANICAL', itemKey: 'mech_start', itemLabel: 'Cold start, idle and smoke' },
  { category: 'MECHANICAL', itemKey: 'mech_oil', itemLabel: 'Fluids, oil and coolant condition' },
  { category: 'MECHANICAL', itemKey: 'mech_trans', itemLabel: 'Clutch or transmission behavior' },
  { category: 'MECHANICAL', itemKey: 'mech_brakes', itemLabel: 'Brakes, suspension and visible leaks' },
  { category: 'TEST_DRIVE', itemKey: 'td_accel', itemLabel: 'Acceleration and engine response' },
  { category: 'TEST_DRIVE', itemKey: 'td_brake', itemLabel: 'Braking test' },
  { category: 'TEST_DRIVE', itemKey: 'td_steering', itemLabel: 'Steering, tracking and vibrations' },
  { category: 'TEST_DRIVE', itemKey: 'td_trans', itemLabel: 'Shifting and unusual driving sounds' },
  { category: 'DOCUMENTS', itemKey: 'doc_vin', itemLabel: 'VIN and document match' },
  { category: 'DOCUMENTS', itemKey: 'doc_service', itemLabel: 'Service history and maintenance proof' },
  { category: 'DOCUMENTS', itemKey: 'doc_title', itemLabel: 'Ownership, finance and legal risk' },
  { category: 'DOCUMENTS', itemKey: 'doc_insurance', itemLabel: 'Damage, insurance and recall history' },
]

export const CANONICAL_CHECKLIST_KEYS = new Set(COMPACT_INSPECTION_CHECKLIST.map((item) => item.itemKey))

export const MERGED_CHECKLIST_ITEM_KEYS: Record<string, string> = {
  pre_price: 'doc_title',
  pre_history: 'doc_insurance',
  pre_recall: 'doc_insurance',
  pre_service: 'doc_service',
  ext_panels: 'ext_paint',
  ext_dents: 'ext_paint',
  ext_glass: 'ext_lights',
  int_infotainment: 'int_dash',
  int_smell: 'int_seats',
  mech_noise: 'mech_start',
  mech_exhaust: 'mech_start',
  mech_coolant: 'mech_oil',
  mech_suspension: 'mech_brakes',
  td_suspension: 'td_trans',
  td_sounds: 'td_trans',
  doc_reg: 'doc_vin',
}

export function canonicalChecklistKey(itemKey: string) {
  return CANONICAL_CHECKLIST_KEYS.has(itemKey) ? itemKey : MERGED_CHECKLIST_ITEM_KEYS[itemKey]
}

export function scoreChecklistAnswer(item: Pick<NormalizableChecklistItem, 'status' | 'notes' | 'photoUrl' | 'updatedAt'>) {
  const updatedAt =
    item.updatedAt instanceof Date ? item.updatedAt.getTime() :
    typeof item.updatedAt === 'string' ? Date.parse(item.updatedAt) :
    0

  return (
    (item.status !== 'PENDING' ? 100 : 0) +
    (item.notes ? 20 : 0) +
    (item.photoUrl ? 10 : 0) +
    (Number.isFinite(updatedAt) ? Math.min(updatedAt / 1_000_000_000_000, 9) : 0)
  )
}

export function normalizeChecklistItems<T extends NormalizableChecklistItem>(items: T[]) {
  return COMPACT_INSPECTION_CHECKLIST.flatMap((seed) => {
    const chosen = items
      .filter((item) => canonicalChecklistKey(item.itemKey) === seed.itemKey)
      .sort((a, b) => scoreChecklistAnswer(b) - scoreChecklistAnswer(a))[0]

    if (!chosen) return []

    return [{
      ...chosen,
      category: seed.category,
      itemKey: seed.itemKey,
      itemLabel: seed.itemLabel,
    }]
  }) as Array<T & Pick<ChecklistItem, 'category' | 'itemKey' | 'itemLabel'>>
}

export function getChecklistDiagnostics(items: NormalizableChecklistItem[]) {
  const canonicalGroups = new Map<string, NormalizableChecklistItem[]>()
  const exactGroups = new Map<string, NormalizableChecklistItem[]>()

  for (const item of items) {
    const canonicalKey = canonicalChecklistKey(item.itemKey) ?? item.itemKey
    canonicalGroups.set(canonicalKey, [...(canonicalGroups.get(canonicalKey) ?? []), item])
    exactGroups.set(item.itemKey, [...(exactGroups.get(item.itemKey) ?? []), item])
  }

  const duplicateCanonicalGroups = [...canonicalGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, count: group.length, itemKeys: group.map((item) => item.itemKey) }))

  const duplicateExactKeys = [...exactGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, count: group.length }))

  const normalized = normalizeChecklistItems(items)

  return {
    originalCount: items.length,
    finalCount: normalized.length,
    duplicateItemCount: duplicateCanonicalGroups.reduce((sum, group) => sum + group.count - 1, 0),
    duplicateCanonicalGroups,
    duplicateExactKeys,
    obsoleteKeys: [...new Set(items.map((item) => item.itemKey).filter((key) => !CANONICAL_CHECKLIST_KEYS.has(key)))],
    missingCanonicalKeys: COMPACT_INSPECTION_CHECKLIST
      .map((item) => item.itemKey)
      .filter((key) => !normalized.some((item) => item.itemKey === key)),
    acCount: normalized.filter((item) => item.itemKey === 'int_ac').length,
    finalItems: normalized.map((item) => ({
      id: item.id,
      category: item.category,
      itemKey: item.itemKey,
      itemLabel: item.itemLabel,
      status: item.status,
      hasInstructionKey: true,
    })),
  }
}

export function getInspectionCompletion(items: NormalizableChecklistItem[]): InspectionCompletionSummary {
  const normalized = normalizeChecklistItems(items)
  const requiredCategories = [...new Set(COMPACT_INSPECTION_CHECKLIST.map((item) => item.category))] as InspectionCompletionCategory[]

  const categoryProgress = requiredCategories.reduce((acc, category) => {
    const expectedItems = COMPACT_INSPECTION_CHECKLIST.filter((item) => item.category === category)
    const answered = expectedItems.filter((seed) => {
      const match = normalized.find((item) => item.category === category && item.itemKey === seed.itemKey)
      return match?.status === 'OK' || match?.status === 'WARNING' || match?.status === 'PROBLEM'
    }).length

    acc[category] = {
      answered,
      total: expectedItems.length,
      complete: expectedItems.length > 0 && answered === expectedItems.length,
    }
    return acc
  }, {} as Record<InspectionCompletionCategory, { answered: number; total: number; complete: boolean }>)

  const totalCount = Object.values(categoryProgress).reduce((sum, category) => sum + category.total, 0)
  const answeredCount = Object.values(categoryProgress).reduce((sum, category) => sum + category.answered, 0)
  const missingCategories = requiredCategories.filter((category) => !categoryProgress[category].complete)

  return {
    isComplete: missingCategories.length === 0 && totalCount > 0,
    answeredCount,
    totalCount,
    missingCategories,
    categoryProgress,
  }
}
