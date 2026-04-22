// =============================================================================
// Prisma Singleton Client
// Prevents creating multiple Prisma Client instances in development
// due to Next.js hot reloading.
//
// DB_PORT env var: set to 5432 or 6432 to override the port in DATABASE_URL.
// Useful when the same codebase runs on machines with different PG port setups.
// =============================================================================

import { PrismaClient } from '@prisma/client'

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

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
