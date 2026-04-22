import { getInspectionCompletion } from '../../src/lib/inspection/checklist'
import type { ChecklistItem } from '../../src/types'

const makeChecklistItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'item-1',
  sessionId: 'session-1',
  category: 'EXTERIOR',
  itemKey: 'ext_paint',
  itemLabel: 'Paint, body panels and repair signs',
  status: 'PENDING',
  ...overrides,
})

describe('getInspectionCompletion', () => {
  test('marks inspection incomplete when required categories are still pending', () => {
    const completion = getInspectionCompletion([
      makeChecklistItem({ category: 'EXTERIOR', itemKey: 'ext_paint', status: 'OK' }),
      makeChecklistItem({ id: '2', category: 'EXTERIOR', itemKey: 'ext_rust', status: 'PENDING' }),
      makeChecklistItem({ id: '3', category: 'MECHANICAL', itemKey: 'mech_start', status: 'PENDING' }),
    ])

    expect(completion.isComplete).toBe(false)
    expect(completion.missingCategories).toContain('EXTERIOR')
    expect(completion.missingCategories).toContain('MECHANICAL')
  })

  test('marks inspection complete only when all canonical checklist items are answered', () => {
    const allItems: ChecklistItem[] = [
      makeChecklistItem({ id: '1', category: 'EXTERIOR', itemKey: 'ext_paint', status: 'OK' }),
      makeChecklistItem({ id: '2', category: 'EXTERIOR', itemKey: 'ext_rust', status: 'WARNING' }),
      makeChecklistItem({ id: '3', category: 'EXTERIOR', itemKey: 'ext_tires', status: 'OK' }),
      makeChecklistItem({ id: '4', category: 'EXTERIOR', itemKey: 'ext_lights', status: 'OK' }),
      makeChecklistItem({ id: '5', category: 'INTERIOR', itemKey: 'int_seats', status: 'OK' }),
      makeChecklistItem({ id: '6', category: 'INTERIOR', itemKey: 'int_dash', status: 'OK' }),
      makeChecklistItem({ id: '7', category: 'INTERIOR', itemKey: 'int_ac', status: 'OK' }),
      makeChecklistItem({ id: '8', category: 'INTERIOR', itemKey: 'int_odometer', status: 'OK' }),
      makeChecklistItem({ id: '9', category: 'MECHANICAL', itemKey: 'mech_start', status: 'OK' }),
      makeChecklistItem({ id: '10', category: 'MECHANICAL', itemKey: 'mech_oil', status: 'OK' }),
      makeChecklistItem({ id: '11', category: 'MECHANICAL', itemKey: 'mech_trans', status: 'PROBLEM' }),
      makeChecklistItem({ id: '12', category: 'MECHANICAL', itemKey: 'mech_brakes', status: 'WARNING' }),
      makeChecklistItem({ id: '13', category: 'TEST_DRIVE', itemKey: 'td_accel', status: 'OK' }),
      makeChecklistItem({ id: '14', category: 'TEST_DRIVE', itemKey: 'td_brake', status: 'OK' }),
      makeChecklistItem({ id: '15', category: 'TEST_DRIVE', itemKey: 'td_steering', status: 'OK' }),
      makeChecklistItem({ id: '16', category: 'TEST_DRIVE', itemKey: 'td_trans', status: 'OK' }),
      makeChecklistItem({ id: '17', category: 'DOCUMENTS', itemKey: 'doc_vin', status: 'OK' }),
      makeChecklistItem({ id: '18', category: 'DOCUMENTS', itemKey: 'doc_service', status: 'OK' }),
      makeChecklistItem({ id: '19', category: 'DOCUMENTS', itemKey: 'doc_title', status: 'OK' }),
      makeChecklistItem({ id: '20', category: 'DOCUMENTS', itemKey: 'doc_insurance', status: 'OK' }),
    ]

    const completion = getInspectionCompletion(allItems)

    expect(completion.isComplete).toBe(true)
    expect(completion.answeredCount).toBe(20)
    expect(completion.totalCount).toBe(20)
    expect(completion.missingCategories).toEqual([])
  })
})
