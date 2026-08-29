// =============================================================================
// POST /api/auth/delete-account — Regression Check
//
// ConsentRecord.userId uses onDelete: SetNull (not Cascade) so consent
// evidence survives account deletion for legal-claims defense — see
// prisma/schema.prisma. That's a database-level FK action, not application
// code, so account deletion itself needs no ConsentRecord-aware logic. This
// test locks in that account deletion keeps working unchanged, and that
// deletion is never itself gated behind requireCurrentConsent (an
// unconsented user must still be able to delete their account).
// =============================================================================

import type { NextRequest } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('../../src/lib/legal/consent-guard', () => ({
  requireCurrentConsent: jest.fn(),
  hasCurrentConsent: jest.fn(),
}))

jest.mock('../../src/config/prisma', () => ({
  prisma: {
    paymentEvent: { deleteMany: jest.fn() },
    user: { delete: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import { POST } from '../../src/app/api/auth/[action]/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { requireCurrentConsent } from '../../src/lib/legal/consent-guard'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockRequireCurrentConsent = requireCurrentConsent as jest.Mock

function postReq(body: unknown): [NextRequest, { params: { action: string } }] {
  const req = { json: async () => body } as unknown as NextRequest
  return [req, { params: { action: 'delete-account' } }]
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true })
  mockRequireCurrentConsent.mockResolvedValue(NextResponse403())
  ;(mockPrisma as any).$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))
})

function NextResponse403() {
  const { NextResponse } = require('next/server')
  return NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 })
}

test('deletes the user (and their payment events) without requiring current consent', async () => {
  const res = await POST(...postReq({ confirmed: true }))

  expect(res.status).toBe(200)
  expect(mockPrisma.paymentEvent.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
  expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  // Never consulted — account deletion must remain reachable even for a
  // user who has not (or can no longer) accept the current legal documents.
  expect(mockRequireCurrentConsent).not.toHaveBeenCalled()
})

test('still requires explicit confirmation', async () => {
  const res = await POST(...postReq({ confirmed: false }))
  expect(res.status).toBe(422)
  expect(mockPrisma.user.delete).not.toHaveBeenCalled()
})
