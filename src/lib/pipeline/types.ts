// =============================================================================
// Pipeline Step Result Types
// Typed discriminated union for inspection pipeline steps.
// Each step returns PipelineOk<T> (success) or PipelineErr<E> (failure).
// The route handler stops at the first failure and returns an appropriate
// HTTP response; on success it passes `data` to the next step.
// =============================================================================

export interface PipelineOk<T> {
  readonly success: true
  /** Name of the step that produced this result. */
  readonly step: string
  readonly data: T
}

export interface PipelineErr<E extends string = string> {
  readonly success: false
  /** Name of the step that failed. */
  readonly step: string
  readonly error: {
    readonly code: E
    /** Human-readable failure message (safe to log; never contains PII). */
    readonly message: string
  }
}

export type PipelineResult<T, E extends string = string> =
  | PipelineOk<T>
  | PipelineErr<E>

/** Construct a successful step result. */
export function pipelineOk<T>(step: string, data: T): PipelineOk<T> {
  return { success: true, step, data }
}

/** Construct a failed step result. */
export function pipelineErr<E extends string = string>(
  step: string,
  code: E,
  message: string,
): PipelineErr<E> {
  return { success: false, step, error: { code, message } }
}
