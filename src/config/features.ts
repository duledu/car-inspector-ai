export type FeatureFlagName = 'community' | 'messages' | 'premium'

function resolveLaunchFlag(publicValue: string | undefined, serverValue: string | undefined): boolean {
  if (publicValue === 'true' || serverValue === 'true') return true
  if (publicValue === 'false' || serverValue === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export const featureFlags: Record<FeatureFlagName, boolean> = {
  community: resolveLaunchFlag(process.env.NEXT_PUBLIC_FEATURE_COMMUNITY, process.env.FEATURE_COMMUNITY),
  messages:  resolveLaunchFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGES,  process.env.FEATURE_MESSAGES),
  // Off until vehicle-history partner integration is live.
  // Set NEXT_PUBLIC_FEATURE_PREMIUM_VISIBLE=true (or FEATURE_PREMIUM_VISIBLE=true) to re-enable.
  premium:   resolveLaunchFlag(process.env.NEXT_PUBLIC_FEATURE_PREMIUM_VISIBLE, process.env.FEATURE_PREMIUM_VISIBLE),
}

export function isFeatureEnabled(feature?: FeatureFlagName): boolean {
  return !feature || featureFlags[feature]
}
