// =============================================================================
// TWA (Trusted Web Activity) detection
//
// Standard technique: Chrome sets document.referrer to "android-app://<pkg>/"
// when a page is opened from a verified TWA's launcher intent. This requires
// no manifest changes and works reliably for our Bubblewrap-generated app.
// =============================================================================

let cached: boolean | null = null

export function isRunningInTwa(): boolean {
  if (typeof document === 'undefined') return false // SSR — never a TWA
  if (cached !== null) return cached

  cached = document.referrer.startsWith('android-app://')
  return cached
}

/** Test-only: clears the memoized detection result. */
export function resetTwaDetectionCache(): void {
  cached = null
}
