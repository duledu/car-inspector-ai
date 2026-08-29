// =============================================================================
// Consent gate placement — boundary check across every protected route
//
// Confirms requireCurrentConsent() runs immediately after requireAuth() and
// before any other work (DB reads/writes, ownership checks, scoring, PDF
// generation) in each route required to be gated. Does not re-test each
// route's own business logic — that's covered by their existing suites (or,
// for routes with none yet, is out of scope here) — only that a blocked
// consent check short-circuits the handler with nothing else attempted.
// =============================================================================

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

jest.mock('../../src/utils/auth.middleware', () => ({ requireAuth: jest.fn() }))
jest.mock('../../src/lib/legal/consent-guard', () => ({ requireCurrentConsent: jest.fn() }))
jest.mock('../../src/lib/inspection/access', () => ({
  verifyVehicleOwnership: jest.fn(),
  startReportGeneration: jest.fn(),
  lockReport: jest.fn(),
  releaseReportGeneration: jest.fn(),
  canViewInspectionReport: jest.fn(),
  getInspectionAccess: jest.fn(),
}))
jest.mock('../../src/config/prisma', () => ({
  prisma: {
    vehicle: { findFirst: jest.fn(), findMany: jest.fn() },
    inspectionSession: { findFirst: jest.fn(), update: jest.fn() },
    checklistItem: { findFirst: jest.fn() },
    accessGrant: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
  isDatabaseUnavailableError: jest.fn().mockReturnValue(false),
}))
jest.mock('../../src/modules/scoring', () => ({ scoringService: { computeAndPersist: jest.fn() } }))
jest.mock('../../src/modules/research/research.service', () => ({ vehicleResearchService: { research: jest.fn() } }))
jest.mock('../../src/lib/report/pdf', () => ({ buildInspectionReportPdf: jest.fn() }))
jest.mock('../../src/modules/integrations/carvertical/carvertical.service', () => ({ carVerticalService: { getReport: jest.fn() } }))
jest.mock('../../src/modules/payments/payment.service', () => ({ paymentService: { createCheckout: jest.fn() } }))
jest.mock('../../src/lib/payments/google-play-verification', () => ({
  GooglePlayVerificationError: class extends Error {},
  verifyGooglePlayPurchase: jest.fn(),
  acknowledgeGooglePlayPurchase: jest.fn(),
  consumeGooglePlayPurchase: jest.fn(),
}))
jest.mock('../../src/lib/payments/google-play-auth', () => ({ getPackageName: jest.fn(() => 'com.usedcarsdoctor.app') }))

import { POST as vehiclePost } from '../../src/app/api/vehicle/route'
import { POST as legacyInspectionPost } from '../../src/app/api/inspection/route'
import { PATCH as vehiclePatch } from '../../src/app/api/vehicle/[id]/route'
import { POST as sessionPost } from '../../src/app/api/inspection/session/route'
import { PATCH as phasePatch } from '../../src/app/api/inspection/session/[id]/phase/route'
import { PATCH as checklistPatch } from '../../src/app/api/inspection/checklist/[itemId]/route'
import { POST as scorePost } from '../../src/app/api/inspection/score/route'
import { POST as pdfPost } from '../../src/app/api/report/pdf/route'
import { GET as premiumReportGet } from '../../src/app/api/premium/report/[vehicleId]/route'
import { POST as checkoutPost } from '../../src/app/api/payment/route'
import { POST as playVerifyPost } from '../../src/app/api/credits/google-play/verify/route'
import { requireAuth } from '../../src/utils/auth.middleware'
import { requireCurrentConsent } from '../../src/lib/legal/consent-guard'
import { verifyVehicleOwnership, startReportGeneration } from '../../src/lib/inspection/access'
import { prisma as mockPrisma } from '../../src/config/prisma'

const mockRequireAuth = requireAuth as jest.Mock
const mockRequireCurrentConsent = requireCurrentConsent as jest.Mock
const mockVerifyOwnership = verifyVehicleOwnership as jest.Mock
const mockStartReportGeneration = startReportGeneration as jest.Mock

const AUTH_SUCCESS = { success: true, userId: 'user-1', email: 'u@test.com', role: 'USER', emailVerified: true }
const BLOCKED = NextResponse.json({ code: 'CONSENT_REQUIRED' }, { status: 403 })

function req(body: unknown = {}): NextRequest {
  return { json: async () => body, headers: { get: () => null } } as unknown as NextRequest
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRequireAuth.mockResolvedValue(AUTH_SUCCESS)
})

describe('consent gate blocks before any protected work', () => {
  test('POST /api/vehicle', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await vehiclePost(req({ make: 'X', model: 'Y', year: 2020 }))
    expect(res.status).toBe(403)
    expect((mockPrisma as any).$transaction).not.toHaveBeenCalled()
  })

  test('POST /api/inspection/session', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await sessionPost(req({ vehicleId: 'v1' }))
    expect(res.status).toBe(403)
    expect((mockPrisma as any).vehicle.findFirst).not.toHaveBeenCalled()
  })

  test('PATCH /api/inspection/session/[id]/phase', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await phasePatch(req({ phase: 'EXTERIOR' }), { params: { id: 's1' } })
    expect(res.status).toBe(403)
    expect((mockPrisma as any).inspectionSession.findFirst).not.toHaveBeenCalled()
  })

  test('PATCH /api/inspection/checklist/[itemId]', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await checklistPatch(req({ status: 'OK' }), { params: { itemId: 'c1' } })
    expect(res.status).toBe(403)
    expect((mockPrisma as any).checklistItem.findFirst).not.toHaveBeenCalled()
  })

  test('POST /api/inspection/score', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await scorePost(req({ vehicleId: 'v1' }))
    expect(res.status).toBe(403)
    expect(mockVerifyOwnership).not.toHaveBeenCalled()
    expect(mockStartReportGeneration).not.toHaveBeenCalled()
  })

  test('POST /api/report/pdf', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await pdfPost(req({ vehicleId: 'v1' }))
    expect(res.status).toBe(403)
    expect((mockPrisma as any).vehicle.findFirst).not.toHaveBeenCalled()
  })

  test('GET /api/premium/report/[vehicleId]', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await premiumReportGet(req(), { params: { vehicleId: 'v1' } })
    expect(res.status).toBe(403)
    expect((mockPrisma as any).vehicle.findFirst).not.toHaveBeenCalled()
  })

  test('PATCH /api/vehicle/[id]', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await vehiclePatch(req({ mileage: 1000 }), { params: { id: 'v1' } })
    expect(res.status).toBe(403)
    expect((mockPrisma as any).vehicle.findFirst).not.toHaveBeenCalled()
  })

  test('POST /api/payment (Stripe checkout)', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const { paymentService } = require('../../src/modules/payments/payment.service')
    const res = await checkoutPost(req({ vehicleId: 'v1', productType: 'INSPECTION_REPORT' }))
    expect(res.status).toBe(403)
    expect(paymentService.createCheckout).not.toHaveBeenCalled()
  })

  test('POST /api/credits/google-play/verify', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const { verifyGooglePlayPurchase } = require('../../src/lib/payments/google-play-verification')
    const res = await playVerifyPost(req({ productId: 'inspection_credit_1', purchaseToken: 'x'.repeat(20) }))
    expect(res.status).toBe(403)
    expect(verifyGooglePlayPurchase).not.toHaveBeenCalled()
  })

  test('POST /api/inspection (legacy duplicate of /api/inspection/score)', async () => {
    mockRequireCurrentConsent.mockResolvedValue(BLOCKED)
    const res = await legacyInspectionPost(req({ vehicleId: 'v1' }))
    expect(res.status).toBe(403)
    expect(mockVerifyOwnership).not.toHaveBeenCalled()
  })
})

describe('consent gate proceeds when consent is current', () => {
  beforeEach(() => {
    mockRequireCurrentConsent.mockResolvedValue(null)
  })

  test('POST /api/inspection/session proceeds to the vehicle-ownership lookup', async () => {
    ;(mockPrisma as any).vehicle.findFirst.mockResolvedValue(null) // vehicle not found — proves the gate let it through
    const res = await sessionPost(req({ vehicleId: 'v1' }))
    expect((mockPrisma as any).vehicle.findFirst).toHaveBeenCalled()
    expect(res.status).toBe(404)
  })

  test('PATCH /api/inspection/checklist/[itemId] proceeds to the item lookup', async () => {
    ;(mockPrisma as any).checklistItem.findFirst.mockResolvedValue(null)
    const res = await checklistPatch(req({ status: 'OK' }), { params: { itemId: 'c1' } })
    expect((mockPrisma as any).checklistItem.findFirst).toHaveBeenCalled()
    expect(res.status).toBe(404)
  })
})
