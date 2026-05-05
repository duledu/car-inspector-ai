// =============================================================================
// Prisma Singleton Client
// Prevents creating multiple Prisma Client instances in development
// due to Next.js hot reloading.
//
// DB_PORT env var: set to 5432 or 6432 to override the port in DATABASE_URL.
// Useful when the same codebase runs on machines with different PG port setups.
// =============================================================================

import { PrismaClient, Prisma } from '@prisma/client'

export const DATABASE_UNAVAILABLE_CODE = 'DATABASE_UNAVAILABLE'

function createDatabaseUnavailableError(): Error & { code: string } {
  const error = new Error('DATABASE_URL is not set') as Error & { code: string }
  error.code = DATABASE_UNAVAILABLE_CODE
  return error
}

function logDatabaseUnavailable() {
  console.error('[prisma] DATABASE_URL is not set. Database features are disabled.')
}

function buildDatabaseUrl(): string | null {
  const base = process.env.DATABASE_URL
  if (!base) {
    // During local/dev runtime, do not crash the whole app because DB is absent.
    // Routes that touch the DB will fail lazily with DATABASE_UNAVAILABLE instead.
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return 'postgresql://build:build@localhost:5432/build'
    }
    return null
  }

  const override = process.env.DB_PORT
  if (!override) return base

  // Replace any :PORT/ pattern in the connection string with the override
  return base.replace(/:(\d{4,5})\//, `:${override}/`)
}

function createUnavailablePrismaProxy(): PrismaClient {
  const makeProxy = (): any => new Proxy(function unavailablePrisma() {}, {
    get(_target, prop) {
      if (prop === 'then') return undefined
      if (prop === 'catch') return undefined
      if (prop === 'finally') return undefined
      return makeProxy()
    },
    apply() {
      throw createDatabaseUnavailableError()
    },
  })

  return makeProxy() as PrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaMissingLogged?: boolean
}

const databaseUrl = buildDatabaseUrl()
const prismaClient =
  databaseUrl
    ? new PrismaClient({
        datasources: { db: { url: databaseUrl } },
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      })
    : (() => {
        if (!globalForPrisma.prismaMissingLogged) {
          logDatabaseUnavailable()
          globalForPrisma.prismaMissingLogged = true
        }
        return createUnavailablePrismaProxy()
      })()

export const prisma =
  globalForPrisma.prisma ??
  prismaClient

export const isDatabaseConfigured = !!databaseUrl

export function isDatabaseUnavailableError(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === DATABASE_UNAVAILABLE_CODE
  )
}

/**
 * Returns true when the error indicates a table or column that the Prisma schema
 * references does not yet exist in the live database — typically because a
 * migration has not been applied yet, or was rolled back partway through.
 *
 * Callers should degrade gracefully (e.g. return a safe legacy fallback) rather
 * than propagating the error as a 500.
 */
export function isMissingTableOrColumnError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2021 = table does not exist, P2022 = column does not exist
    return err.code === 'P2021' || err.code === 'P2022'
  }
  const code = (err as { code?: string })?.code
  if (code === '42P01' || code === '42703') {
    return true
  }
  const cause = (err as { cause?: unknown })?.cause
  if (cause && cause !== err && isMissingTableOrColumnError(cause)) {
    return true
  }
  // Raw PostgreSQL errors (e.g. wrapped in PrismaClientUnknownRequestError)
  // carry the "does not exist" message from the DB engine.
  const msg = ((err as { message?: string })?.message ?? '').toLowerCase()
  return (
    (msg.includes('relation') || msg.includes('column') || msg.includes('table')) &&
    msg.includes('does not exist')
  )
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
