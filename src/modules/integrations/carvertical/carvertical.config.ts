// =============================================================================
// CarVertical Configuration
// All CarVertical-specific settings in one place. Never scattered across files.
// =============================================================================

export const carVerticalConfig = {
  baseUrl: process.env.CARVERTICAL_BASE_URL ?? 'https://api.carvertical.com/v1',
  apiKey: process.env.CARVERTICAL_API_KEY ?? '',
  apiVersion: '2024-01',
  timeoutMs: 15_000,
  retryAttempts: 2,
  cacheTtlSeconds: 60 * 60 * 24, // 24 hours — report data doesn't change
  useMock: process.env.CARVERTICAL_USE_MOCK === 'true' || process.env.NODE_ENV === 'development',
} as const
