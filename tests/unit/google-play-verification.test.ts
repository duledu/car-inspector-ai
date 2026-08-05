// =============================================================================
// Google Play Verification — Unit Tests
// The androidpublisher client is fully mocked; no network calls are made.
// =============================================================================

jest.mock('../../src/lib/payments/google-play-auth', () => ({
  getAndroidPublisherClient: jest.fn(),
  getPackageName: jest.fn(() => 'com.usedcarsdoctor.app'),
}))

const { getAndroidPublisherClient, getPackageName } = jest.requireMock('../../src/lib/payments/google-play-auth') as {
  getAndroidPublisherClient: jest.Mock
  getPackageName: jest.Mock
}

import {
  verifyGooglePlayPurchase,
  acknowledgeGooglePlayPurchase,
  consumeGooglePlayPurchase,
  GooglePlayVerificationError,
} from '../../src/lib/payments/google-play-verification'

const mockGet = jest.fn()
const mockAcknowledge = jest.fn()
const mockConsume = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  getPackageName.mockReturnValue('com.usedcarsdoctor.app')
  getAndroidPublisherClient.mockReturnValue({
    purchases: { products: { get: mockGet, acknowledge: mockAcknowledge, consume: mockConsume } },
  })
})

describe('verifyGooglePlayPurchase', () => {
  test('returns verified purchase details for a PURCHASED (state 0) token', async () => {
    mockGet.mockResolvedValue({
      data: { purchaseState: 0, consumptionState: 0, acknowledgementState: 0, orderId: 'GPA.1234-5678', purchaseTimeMillis: '1700000000000' },
    })

    const result = await verifyGooglePlayPurchase({
      purchaseToken: 'tok-abc',
      productId: 'inspection_credit_1',
      packageName: 'com.usedcarsdoctor.app',
    })

    expect(result.purchaseState).toBe(0)
    expect(result.orderId).toBe('GPA.1234-5678')
    expect(mockGet).toHaveBeenCalledWith({
      packageName: 'com.usedcarsdoctor.app',
      productId: 'inspection_credit_1',
      token: 'tok-abc',
    })
  })

  test('passes through a PENDING (state 2) purchase untouched', async () => {
    mockGet.mockResolvedValue({ data: { purchaseState: 2, consumptionState: 0, acknowledgementState: 0 } })
    const result = await verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'inspection_credit_1', packageName: 'com.usedcarsdoctor.app' })
    expect(result.purchaseState).toBe(2)
  })

  test('passes through a CANCELLED (state 1) purchase untouched', async () => {
    mockGet.mockResolvedValue({ data: { purchaseState: 1, consumptionState: 0, acknowledgementState: 0 } })
    const result = await verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'inspection_credit_1', packageName: 'com.usedcarsdoctor.app' })
    expect(result.purchaseState).toBe(1)
  })

  test('rejects with PACKAGE_MISMATCH before calling the API for a wrong package name', async () => {
    await expect(
      verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'x', packageName: 'com.evil.app' }),
    ).rejects.toMatchObject({ code: 'PACKAGE_MISMATCH' })
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('rejects with INVALID_TOKEN when Google returns a 404', async () => {
    mockGet.mockRejectedValue({ code: 404 })
    await expect(
      verifyGooglePlayPurchase({ purchaseToken: 'bad-token', productId: 'x', packageName: 'com.usedcarsdoctor.app' }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' })
  })

  test('rejects with VERIFICATION_FAILED on an unexpected API error', async () => {
    mockGet.mockRejectedValue(new Error('network down'))
    await expect(
      verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'x', packageName: 'com.usedcarsdoctor.app' }),
    ).rejects.toMatchObject({ code: 'VERIFICATION_FAILED' })
  })

  test('rejects with INVALID_RESPONSE when Google omits purchaseState', async () => {
    mockGet.mockResolvedValue({ data: {} })
    await expect(
      verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'x', packageName: 'com.usedcarsdoctor.app' }),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })

  test('all rejections are GooglePlayVerificationError instances', async () => {
    mockGet.mockRejectedValue(new Error('boom'))
    await expect(
      verifyGooglePlayPurchase({ purchaseToken: 'tok', productId: 'x', packageName: 'com.usedcarsdoctor.app' }),
    ).rejects.toBeInstanceOf(GooglePlayVerificationError)
  })
})

describe('acknowledgeGooglePlayPurchase', () => {
  test('calls the acknowledge endpoint with the expected package', async () => {
    mockAcknowledge.mockResolvedValue({})
    await acknowledgeGooglePlayPurchase('tok', 'inspection_credit_1', 'com.usedcarsdoctor.app')
    expect(mockAcknowledge).toHaveBeenCalledWith({
      packageName: 'com.usedcarsdoctor.app',
      productId: 'inspection_credit_1',
      token: 'tok',
      requestBody: {},
    })
  })

  test('rejects with PACKAGE_MISMATCH for a wrong package name', async () => {
    await expect(acknowledgeGooglePlayPurchase('tok', 'x', 'com.evil.app')).rejects.toMatchObject({ code: 'PACKAGE_MISMATCH' })
    expect(mockAcknowledge).not.toHaveBeenCalled()
  })

  test('wraps API failures as ACKNOWLEDGE_FAILED', async () => {
    mockAcknowledge.mockRejectedValue(new Error('boom'))
    await expect(acknowledgeGooglePlayPurchase('tok', 'x', 'com.usedcarsdoctor.app')).rejects.toMatchObject({ code: 'ACKNOWLEDGE_FAILED' })
  })
})

describe('consumeGooglePlayPurchase', () => {
  test('calls the consume endpoint with the expected package', async () => {
    mockConsume.mockResolvedValue({})
    await consumeGooglePlayPurchase('tok', 'inspection_credit_1', 'com.usedcarsdoctor.app')
    expect(mockConsume).toHaveBeenCalledWith({
      packageName: 'com.usedcarsdoctor.app',
      productId: 'inspection_credit_1',
      token: 'tok',
    })
  })

  test('wraps API failures as CONSUME_FAILED', async () => {
    mockConsume.mockRejectedValue(new Error('boom'))
    await expect(consumeGooglePlayPurchase('tok', 'x', 'com.usedcarsdoctor.app')).rejects.toMatchObject({ code: 'CONSUME_FAILED' })
  })
})
