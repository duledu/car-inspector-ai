// =============================================================================
// Prisma Seed — dev accounts
//
// Creates two accounts if they do not already exist:
//   1. admin@test.com / Admin123!    — ADMIN role, full access
//   2. duledu25@gmail.com / duledu25 — USER role, original dev account
//
// Safe to run multiple times (idempotent — skips existing accounts).
// Run: npm run db:seed
// =============================================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
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

// Dev-only defaults — override via env vars in any environment
const DEV_ADMIN_CREDS = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!'
const DEV_USER_CREDS  = process.env.SEED_USER_PASSWORD  ?? 'duledu25'

const SEED_ACCOUNTS: SeedAccount[] = [
  { email: 'admin@test.com',       password: DEV_ADMIN_CREDS, name: 'Admin',             role: 'ADMIN' },
  { email: 'duledu25@gmail.com',   password: DEV_USER_CREDS,  name: 'Dusan Stevanovic',  role: 'USER'  },
]

async function upsertAccount(account: SeedAccount) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } })

  if (existing) {
    if (existing.role === account.role) {
      console.log(`  ${account.email} already exists (${account.role}) — skipped`)
      return
    }
    await prisma.user.update({
      where: { email: account.email },
      data: { role: account.role },
    })
    console.log(`↑ Updated role for ${account.email} → ${account.role}`)
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

  console.log(`✔ Created ${user.role}: ${user.email}`)
  console.log(`  Password : ${account.password}`)
  console.log(`  ID       : ${user.id}`)
}

async function main() {
  console.log('\n── Seeding dev accounts ─────────────────────────\n')
  for (const account of SEED_ACCOUNTS) {
    await upsertAccount(account)
  }
  console.log('\n─────────────────────────────────────────────────')
  console.log('Admin : admin@test.com     / Admin123!')
  console.log('User  : duledu25@gmail.com / duledu25')
  console.log('─────────────────────────────────────────────────\n')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
