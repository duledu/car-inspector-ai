/**
 * @jest-environment jsdom
 */
// =============================================================================
// TWA Detection — Unit Tests
// =============================================================================

import { isRunningInTwa, resetTwaDetectionCache } from '../../src/utils/platform/is-twa'

function setReferrer(value: string) {
  Object.defineProperty(document, 'referrer', { value, configurable: true })
}

beforeEach(() => {
  resetTwaDetectionCache()
  setReferrer('')
})

describe('isRunningInTwa', () => {
  test('returns true when referrer starts with android-app://', () => {
    setReferrer('android-app://com.usedcarsdoctor.app/')
    expect(isRunningInTwa()).toBe(true)
  })

  test('returns false for a normal web referrer', () => {
    setReferrer('https://usedcarsdoctor.com/dashboard')
    expect(isRunningInTwa()).toBe(false)
  })

  test('returns false for an empty referrer', () => {
    setReferrer('')
    expect(isRunningInTwa()).toBe(false)
  })

  test('memoizes the result — a later referrer change does not flip it', () => {
    setReferrer('android-app://com.usedcarsdoctor.app/')
    expect(isRunningInTwa()).toBe(true)
    setReferrer('')
    expect(isRunningInTwa()).toBe(true)
  })
})
