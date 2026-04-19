// =============================================================================
// Prisma Seed - development accounts
//
// Creates optional local accounts for development. Configure credentials with:
//   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_USER_EMAIL, SEED_USER_PASSWORD
//
// Passwords are never printed to the console.
// =============================================================================

import { PrismaClient } from '.prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

type Role = 'ADMIN' | 'USER' | 'MODERATOR'

interface SeedAccount {
  email: string
  password: string
  name: string
  role: Role
}

function getSeedAccounts(): SeedAccount[] {
  const accounts: SeedAccount[] = []

  const adminEmail = process.env.SEED_ADMIN_EMAIL
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (adminEmail && adminPassword) {
    accounts.push({
      email: adminEmail,
      password: adminPassword,
      name: process.env.SEED_ADMIN_NAME ?? 'Admin',
      role: 'ADMIN',
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
    })
  }

  return accounts
}

async function upsertAccount(account: SeedAccount) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } })

  if (existing) {
    if (existing.role === account.role) {
      console.log(`  ${account.email} already exists (${account.role}) - skipped`)
      return
    }

    await prisma.user.update({
      where: { email: account.email },
      data: { role: account.role },
    })
    console.log(`  Updated role for ${account.email} -> ${account.role}`)
    return
  }

  const passwordHash = await bcrypt.hash(account.password, 12)
  const user = await prisma.user.create({
    data: {
      email: account.email,
      name: account.name,
      passwordHash,
      role: account.role,
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
