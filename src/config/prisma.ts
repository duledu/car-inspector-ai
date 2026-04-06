// =============================================================================
// Prisma Singleton Client
// Prevents creating multiple Prisma Client instances in development
// due to Next.js hot reloading.
//
// DB_PORT env var: set to 5432 or 6432 to override the port in DATABASE_URL.
// Useful when the same codebase runs on machines with different PG port setups.
// =============================================================================

import { PrismaClient } from '@prisma/client'

function buildDatabaseUrl(): string {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error('DATABASE_URL is not set')

  const override = process.env.DB_PORT
  if (!override) return base

  // Replace any :PORT/ pattern in the connection string with the override
  return base.replace(/:(\d{4,5})\//, `:${override}/`)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
