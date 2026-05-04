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

// Allowed characters: alphanumeric, hyphen, underscore. Length: 4–64.
// Rejects anything that could be used for log injection (newlines, colons, etc.).
const REQUEST_ID_RE = /^[a-zA-Z0-9_-]{4,64}$/

/**
 * Validate a requestId received from an external source (e.g. the x-request-id header).
 * Returns the value unchanged when valid; returns null when the value is absent or unsafe.
 * Call this on every inbound header value before using it in logs.
 */
export function parseRequestId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  return REQUEST_ID_RE.test(value) ? value : null
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
