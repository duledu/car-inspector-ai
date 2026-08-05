// =============================================================================
// Minimal in-memory rate limiter
// Scoped to the new Google Play billing routes only — not a general-purpose
// retrofit onto existing routes. Sliding window per (key, route).
//
// Limitation: in-memory, per Node process. Fine for the current single-
// instance deployment; if this app ever runs multi-instance, replace the
// Map below with a shared store (Redis, etc.) behind the same interface.
// =============================================================================

interface Bucket {
  count: number
  windowStartMs: number
}

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterMs: number
}

/**
 * Returns whether `key` (e.g. `${route}:${userId}`) may proceed under a
 * `limit` requests per `windowMs` sliding window.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now - existing.windowStartMs >= windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now })
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, retryAfterMs: windowMs - (now - existing.windowStartMs) }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 }
}

/** Test-only: clears all buckets between test cases. */
export function resetRateLimits(): void {
  buckets.clear()
}
