// =============================================================================
// hasAiAnalysisAccess() — Unit Tests
//
// This is the real payment gate behind /api/inspection/analyze-photo and
// /api/ai-analysis/analyze. Proves the exact product-entitlement matrix the
// payment-gate fix requires:
//   - DRAFT (every vehicle's default status at creation) must NOT grant access
//   - ACTIVE (INSPECTION_REPORT / FULL_INSPECTION_BUNDLE purchase or promo) grants access
//   - LOCKED (report already generated/consumed) does not, by itself, grant access
//   - A standalone AI_DEEP_SCAN or FULL_INSPECTION_BUNDLE AccessGrant grants access
//     independently of InspectionReport status
// =============================================================================

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    inspectionReport: { findFirst: jest.fn() },
    accessGrant: { findFirst: jest.fn() },
  },
  isMissingTableOrColumnError: jest.fn().mockReturnValue(false),
}))

import { hasAiAnalysisAccess } from '../../src/lib/inspection/access'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockReportFindFirst = (mockPrisma as any).inspectionReport.findFirst as jest.Mock
const mockGrantFindFirst = (mockPrisma as any).accessGrant.findFirst as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

/** getInspectionAccess() reads the ACTIVE row first, then falls back to the latest row of any status. */
function mockReportStatus(status: 'ACTIVE' | 'DRAFT' | 'LOCKED' | null) {
  if (status === 'ACTIVE') {
    mockReportFindFirst.mockResolvedValueOnce({ id: 'r1', status: 'ACTIVE', grantedVia: 'purchase' })
    return
  }
  mockReportFindFirst.mockResolvedValueOnce(null) // no ACTIVE row
  if (status === null) {
    mockReportFindFirst.mockResolvedValueOnce(null) // no row at all
  } else {
    mockReportFindFirst.mockResolvedValueOnce({ id: 'r1', status, grantedVia: status === 'DRAFT' ? 'gate' : 'purchase' })
  }
}

describe('hasAiAnalysisAccess', () => {
  test('B: a standalone AI_DEEP_SCAN entitlement grants access even with DRAFT (never purchased) report status', async () => {
    mockReportStatus('DRAFT')
    mockGrantFindFirst.mockResolvedValue({ id: 'grant-1' }) // AI_DEEP_SCAN or FULL_INSPECTION_BUNDLE grant
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(true)
  })

  test('B: AI_DEEP_SCAN alone does not imply INSPECTION_REPORT access (checked separately by score/PDF routes)', async () => {
    // hasAiAnalysisAccess itself only answers the Deep Scan question; report
    // generation is independently gated by startReportGeneration's own ACTIVE check.
    mockReportStatus('DRAFT')
    mockGrantFindFirst.mockResolvedValue({ id: 'grant-1' })
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(true)
    // report status remains DRAFT — startReportGeneration would still reject report generation.
  })

  test('C: FULL_INSPECTION_BUNDLE (via ACTIVE report status granted by the bundle purchase) allows Deep Scan', async () => {
    mockReportStatus('ACTIVE')
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(true)
    expect(mockGrantFindFirst).not.toHaveBeenCalled() // ACTIVE short-circuits before the entitlement query
  })

  test('D: INSPECTION_REPORT-only purchase (ACTIVE report) allows Deep Scan — matches existing report flow', async () => {
    mockReportStatus('ACTIVE')
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(true)
  })

  test('the confirmed bypass: DRAFT status with no entitlement is rejected', async () => {
    mockReportStatus('DRAFT')
    mockGrantFindFirst.mockResolvedValue(null)
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(false)
  })

  test('no InspectionReport row at all (status NONE) with no entitlement is rejected', async () => {
    mockReportStatus(null)
    mockGrantFindFirst.mockResolvedValue(null)
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(false)
  })

  test('LOCKED status alone (report already generated/consumed) does not grant further Deep Scan access', async () => {
    mockReportStatus('LOCKED')
    mockGrantFindFirst.mockResolvedValue(null)
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(false)
  })

  test('LOCKED status with a separate active AI_DEEP_SCAN grant still allows Deep Scan', async () => {
    mockReportStatus('LOCKED')
    mockGrantFindFirst.mockResolvedValue({ id: 'grant-1' })
    await expect(hasAiAnalysisAccess('user-1', 'v1')).resolves.toBe(true)
  })
})
