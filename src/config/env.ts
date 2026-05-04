// =============================================================================
// Environment Configuration
// Single source of truth for all env vars. Validates at startup.
// Import this, never process.env directly in application code.
// =============================================================================

function requireEnv(key: string): string {
  const value = process.env[key]
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
  if (key === 'DATABASE_URL') {
    if (!value && process.env.NODE_ENV === 'production' && !isBuild) {
      throw new Error('[env] DATABASE_URL is required in production. The application cannot start without a database connection.')
    }
    return value ?? ''
  }
  if (!value && process.env.NODE_ENV === 'production' && !isBuild) {
    throw new Error(`Required environment variable "${key}" is not set.`)
  }
  return value ?? ''
}

export const env = {
  // App
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api',

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // Auth — validated at request-time in auth.middleware.ts, not at module load
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',

  // CarVertical
  carVerticalApiKey: process.env.CARVERTICAL_API_KEY ?? '',
  carVerticalBaseUrl: process.env.CARVERTICAL_BASE_URL ?? 'https://api.carvertical.com/v1',
  carVerticalUseMock: process.env.CARVERTICAL_USE_MOCK === 'true',

  // Storage (S3 / R2 for photos)
  storageEndpoint: process.env.STORAGE_ENDPOINT ?? '',
  storageAccessKey: process.env.STORAGE_ACCESS_KEY ?? '',
  storageSecretKey: process.env.STORAGE_SECRET_KEY ?? '',
  storageBucket: process.env.STORAGE_BUCKET ?? 'uci-photos',

  // OpenAI
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',

  // Feature flags
  features: {
    realTimeMessaging: process.env.FEATURE_REALTIME_MESSAGING === 'true',
    aiDeepScan: process.env.FEATURE_AI_DEEP_SCAN === 'true',
  },
} as const

export type Env = typeof env
