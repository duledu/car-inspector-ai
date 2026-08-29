// =============================================================================
// Prisma Seed - development accounts
//
// Creates local accounts for development. Configure credentials with:
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL, SEED_USER_PASSWORD
//
// Passwords are never printed to the console.
// Default test credentials are disabled in production.
// =============================================================================

import fs from 'fs'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { computeLegalContentHash } from '../src/lib/legal/legal-content-hash'
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_RISK_ACK_VERSION,
  LEGAL_EFFECTIVE_DATE,
} from '../src/lib/legal/legal-config'

function loadLocalEnv() {
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue

    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (!match || process.env[match[1]]) continue

      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
}

loadLocalEnv()

const prisma = new PrismaClient()

type Role = 'ADMIN' | 'USER' | 'MODERATOR'

interface SeedAccount {
  email: string
  password: string
  name: string
  role: Role
  verified: boolean
}

function getSeedAccounts(): SeedAccount[] {
  const isProduction = process.env.NODE_ENV === 'production'
  const accounts: SeedAccount[] = []

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? (isProduction ? undefined : 'admin@test.com')
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? (isProduction ? undefined : 'Admin123!')
  if (adminEmail && adminPassword) {
    accounts.push({
      email: adminEmail,
      password: adminPassword,
      name: process.env.SEED_ADMIN_NAME ?? 'Admin',
      role: 'ADMIN',
      verified: true,
    })
  }

  const userEmail = process.env.SEED_USER_EMAIL
  const userPassword = process.env.SEED_USER_PASSWORD
  if (userEmail && userPassword) {
    accounts.push({
      email: userEmail,
      password: userPassword,
      name: process.env.SEED_USER_NAME ?? 'Test User',
      role: 'USER',
      verified: false,
    })
  }

  return accounts
}

async function upsertAccount(account: SeedAccount) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } })

  if (existing) {
    const data: { role?: Role; passwordHash?: string; emailVerified?: Date } = {}
    if (existing.role !== account.role) data.role = account.role
    const resetPasswords = process.env.SEED_RESET_PASSWORDS === 'true' || process.argv.includes('--reset')
    if (!existing.passwordHash || resetPasswords) {
      data.passwordHash = await bcrypt.hash(account.password, 12)
    }
    if (account.verified && !existing.emailVerified) data.emailVerified = new Date()

    if (Object.keys(data).length === 0) {
      console.log(`  ${account.email} already exists (${account.role}) - ready`)
      return
    }

    await prisma.user.update({
      where: { email: account.email },
      data,
    })
    console.log(`  Updated seed account: ${account.email}`)
    return
  }

  const passwordHash = await bcrypt.hash(account.password, 12)
  const user = await prisma.user.create({
    data: {
      email: account.email,
      name: account.name,
      passwordHash,
      role: account.role,
      emailVerified: account.verified ? new Date() : null,
    },
  })

  console.log(`  Created ${user.role}: ${user.email}`)
}

// =============================================================================
// Legal document versions
//
// Records the canonical content hash for each currently-required legal
// document version, so drift between the running app (legal-config.ts) and
// the actual en.ts text can be detected later (see
// tests/unit/legal-content-hash.test.ts). This table is append-only evidence
// metadata, not a live document store — the rendered legal pages always read
// directly from en.ts/sr.ts. Upsert is keyed on [documentType, version], so
// re-running the seed after a version bump adds a new row rather than
// mutating history.
// =============================================================================
const LEGAL_DOCUMENT_VERSIONS = [
  { documentType: 'TERMS' as const, version: CURRENT_TERMS_VERSION },
  { documentType: 'PRIVACY' as const, version: CURRENT_PRIVACY_VERSION },
  { documentType: 'RISK_ACKNOWLEDGEMENT' as const, version: CURRENT_RISK_ACK_VERSION },
]

async function seedLegalDocumentVersions() {
  console.log('\nSeeding legal document versions\n')
  for (const { documentType, version } of LEGAL_DOCUMENT_VERSIONS) {
    const contentHash = computeLegalContentHash(documentType)
    await prisma.legalDocumentVersion.upsert({
      where: { documentType_version: { documentType, version } },
      update: { contentHash, effectiveDate: new Date(LEGAL_EFFECTIVE_DATE) },
      create: {
        documentType,
        version,
        effectiveDate: new Date(LEGAL_EFFECTIVE_DATE),
        contentHash,
      },
    })
    console.log(`  ${documentType} ${version} -> ${contentHash.slice(0, 12)}...`)
  }
}

async function main() {
  const accounts = getSeedAccounts()

  console.log('\nSeeding development accounts\n')
  if (accounts.length === 0) {
    console.log('  No seed accounts configured. Set SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD or SEED_USER_EMAIL/SEED_USER_PASSWORD.')
  } else {
    for (const account of accounts) {
      await upsertAccount(account)
    }
  }

  await seedLegalDocumentVersions()
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
