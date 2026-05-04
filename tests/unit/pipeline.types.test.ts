// =============================================================================
// Pipeline Types — Unit Tests
// Tests the PipelineResult helpers used by the inspection analysis pipeline.
// Run: npx jest tests/unit/pipeline.types.test.ts
// =============================================================================

import { pipelineOk, pipelineErr, type PipelineResult } from '../../src/lib/pipeline/types'

describe('pipelineOk', () => {
  it('returns a success result with step and data', () => {
    const result = pipelineOk('my-step', { value: 42 })
    expect(result.success).toBe(true)
    expect(result.step).toBe('my-step')
    if (result.success) {
      expect(result.data).toEqual({ value: 42 })
    }
  })

  it('works with void / undefined data', () => {
    const result = pipelineOk('check-step', undefined)
    expect(result.success).toBe(true)
    expect(result.step).toBe('check-step')
  })

  it('works with string data', () => {
    const result = pipelineOk('get-api-key', 'sk-test-key')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe('sk-test-key')
    }
  })
})

describe('pipelineErr', () => {
  it('returns a failure result with step, code, and message', () => {
    const result = pipelineErr('validate-request', 'VALIDATION_ERROR', '2 validation issue(s)')
    expect(result.success).toBe(false)
    expect(result.step).toBe('validate-request')
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR')
      expect(result.error.message).toBe('2 validation issue(s)')
    }
  })

  it('preserves the exact error code', () => {
    const result = pipelineErr('check-image-size', 'IMAGE_VALIDATION', 'Image too large')
    if (!result.success) {
      expect(result.error.code).toBe('IMAGE_VALIDATION')
    }
  })

  it('preserves the exact error message', () => {
    const msg = 'Angle "UNKNOWN_ANGLE" is not a recognised inspection shot.'
    const result = pipelineErr('check-angle', 'IMAGE_VALIDATION', msg)
    if (!result.success) {
      expect(result.error.message).toBe(msg)
    }
  })
})

describe('PipelineResult discriminated union', () => {
  it('success narrows to PipelineOk', () => {
    const result: PipelineResult<number> = pipelineOk('step', 99)
    if (result.success) {
      // TypeScript would flag result.error here — this verifies the shape at runtime
      expect(result.data).toBe(99)
      expect('error' in result).toBe(false)
    }
  })

  it('failure narrows to PipelineErr', () => {
    const result: PipelineResult<number, 'CONFIG_ERROR'> = pipelineErr('step', 'CONFIG_ERROR', 'no key')
    if (!result.success) {
      expect(result.error.code).toBe('CONFIG_ERROR')
      expect('data' in result).toBe(false)
    }
  })

  it('success and failure are mutually exclusive via success flag', () => {
    const ok  = pipelineOk('s', 1)
    const err = pipelineErr('s', 'ERR', 'msg')
    expect(ok.success).toBe(true)
    expect(err.success).toBe(false)
    expect(ok.success === err.success).toBe(false)
  })

  it('step name is always present on both variants', () => {
    const ok  = pipelineOk('step-a', 0)
    const err = pipelineErr('step-b', 'ERR', 'msg')
    expect(ok.step).toBe('step-a')
    expect(err.step).toBe('step-b')
  })
})

describe('pipeline step sequence pattern', () => {
  // Simulates how the route handler chains steps
  function stepA(input: number): PipelineResult<number, 'NEG'> {
    if (input < 0) return pipelineErr('step-a', 'NEG', 'Input must be non-negative')
    return pipelineOk('step-a', input * 2)
  }

  function stepB(input: number): PipelineResult<string, 'ZERO'> {
    if (input === 0) return pipelineErr('step-b', 'ZERO', 'Cannot process zero')
    return pipelineOk('step-b', `value:${input}`)
  }

  it('propagates success through multiple steps', () => {
    const a = stepA(5)
    if (!a.success) { fail('Expected step A to succeed') }
    const b = stepB(a.data)
    expect(b.success).toBe(true)
    if (b.success) {
      expect(b.data).toBe('value:10')
    }
  })

  it('stops at first failure', () => {
    const a = stepA(-1)
    expect(a.success).toBe(false)
    if (!a.success) {
      expect(a.error.code).toBe('NEG')
    }
    // Step B is never called
  })

  it('step B failure is caught independently', () => {
    const a = stepA(0) // 0 * 2 = 0
    if (!a.success) { fail('Expected step A to succeed') }
    const b = stepB(a.data)
    expect(b.success).toBe(false)
    if (!b.success) {
      expect(b.error.code).toBe('ZERO')
      expect(b.step).toBe('step-b')
    }
  })
})
