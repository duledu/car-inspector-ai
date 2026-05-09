export type FeatureFlagName = 'community' | 'messages'

function resolveLaunchFlag(publicValue: string | undefined, serverValue: string | undefined): boolean {
  if (publicValue === 'true' || serverValue === 'true') return true
  if (publicValue === 'false' || serverValue === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export const featureFlags: Record<FeatureFlagName, boolean> = {
  community: resolveLaunchFlag(process.env.NEXT_PUBLIC_FEATURE_COMMUNITY, process.env.FEATURE_COMMUNITY),
  messages: resolveLaunchFlag(process.env.NEXT_PUBLIC_FEATURE_MESSAGES, process.env.FEATURE_MESSAGES),
}

export function isFeatureEnabled(feature?: FeatureFlagName): boolean {
  return !feature || featureFlags[feature]
}
