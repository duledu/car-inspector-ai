// Structured pipeline logger for the inspection flow.
// Outputs newline-delimited JSON to stdout (success) or stderr (failure).
// Compatible with Vercel log drains and standard log search tools.
// Safe for production: never log images, base64, prompts, or personal data.

export interface PipelineLogEntry {
  step: string
  requestId: string
  vehicleId?: string
  userId?: string
  durationMs?: number
  success: boolean
  meta?: Record<string, unknown>
}

/** Generate a short, collision-resistant identifier for a single request. */
export function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  return Math.random().toString(36).slice(2, 10)
}

/**
 * Emit one structured log line for the pipeline.
 * Routes to console.error on failure so Vercel separates it in stderr output.
 */
export function pipelineLog(entry: PipelineLogEntry): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry })
  if (entry.success === false) {
    console.error(line)
  } else {
    console.log(line)
  }
}
