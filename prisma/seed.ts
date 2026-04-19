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
import { PrismaClient } from '.prisma/client'
import bcrypt from 'bcryptjs'

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
    if (!existing.passwordHash || process.env.SEED_RESET_PASSWORDS === 'true') {
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

async function main() {
  const accounts = getSeedAccounts()

  console.log('\nSeeding development accounts\n')
  if (accounts.length === 0) {
    console.log('  No seed accounts configured. Set SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD or SEED_USER_EMAIL/SEED_USER_PASSWORD.')
    return
  }

  for (const account of accounts) {
    await upsertAccount(account)
  }
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
