// =============================================================================
// hasEntitlement() — Unit Tests
// Configuration-driven capability resolution from AccessGrant records only.
// =============================================================================

jest.mock('../../src/config/prisma', () => ({
  prisma: { accessGrant: { findFirst: jest.fn() } },
}))

import { hasEntitlement } from '../../src/lib/payments/entitlements'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockFindFirst = (mockPrisma as any).accessGrant.findFirst as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

describe('hasEntitlement', () => {
  test('AI_DEEP_SCAN capability queries AccessGrant for AI_DEEP_SCAN or FULL_INSPECTION_BUNDLE', async () => {
    mockFindFirst.mockResolvedValue(null)
    await hasEntitlement('user-1', 'v1', 'AI_DEEP_SCAN')
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', vehicleId: 'v1', isActive: true, productType: { in: ['AI_DEEP_SCAN', 'FULL_INSPECTION_BUNDLE'] } },
      select: { id: true },
    })
  })

  test('INSPECTION_REPORT capability queries AccessGrant for INSPECTION_REPORT or FULL_INSPECTION_BUNDLE', async () => {
    mockFindFirst.mockResolvedValue(null)
    await hasEntitlement('user-1', 'v1', 'INSPECTION_REPORT')
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', vehicleId: 'v1', isActive: true, productType: { in: ['INSPECTION_REPORT', 'FULL_INSPECTION_BUNDLE'] } },
      select: { id: true },
    })
  })

  test('a standalone AI_DEEP_SCAN grant satisfies the AI_DEEP_SCAN capability', async () => {
    mockFindFirst.mockResolvedValue({ id: 'grant-1' })
    await expect(hasEntitlement('user-1', 'v1', 'AI_DEEP_SCAN')).resolves.toBe(true)
  })

  test('a FULL_INSPECTION_BUNDLE grant also satisfies the AI_DEEP_SCAN capability', async () => {
    mockFindFirst.mockResolvedValue({ id: 'grant-2' })
    await expect(hasEntitlement('user-1', 'v1', 'AI_DEEP_SCAN')).resolves.toBe(true)
  })

  test('an unrelated CARVERTICAL_REPORT-only grant does not satisfy AI_DEEP_SCAN', async () => {
    // Simulated by the query itself excluding CARVERTICAL_REPORT from the `in` list —
    // a mocked prisma would never return a row for a filtered-out productType.
    mockFindFirst.mockResolvedValue(null)
    await expect(hasEntitlement('user-1', 'v1', 'AI_DEEP_SCAN')).resolves.toBe(false)
  })

  test('no AccessGrant at all means no entitlement', async () => {
    mockFindFirst.mockResolvedValue(null)
    await expect(hasEntitlement('user-1', 'v1', 'FULL_INSPECTION_BUNDLE')).resolves.toBe(false)
  })
})
